import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const supabase = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const allowTestCreditGrants =
  process.env.STRIPE_ALLOW_TEST_CREDIT_GRANTS === "true";

function getCreditsForPrice(priceId: string): number {
  switch (priceId) {
    case process.env.STRIPE_PRICE_ESSENTIAL_MONTHLY:
      return 4000;
    case process.env.STRIPE_PRICE_ADVANCED_MONTHLY:
      return 12000;
    case process.env.STRIPE_PRICE_INFINITE_MONTHLY:
      return 24000;
    case process.env.STRIPE_PRICE_STUDIO_MONTHLY:
      return 106000;
    default:
      return 0;
  }
}

async function resolveUserIdFromCustomer(
  customerId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    console.error("Could not resolve stripe customer to user:", error);
    throw new Error(
      error.message || "Could not resolve stripe customer to user"
    );
  }

  return data?.user_id ?? null;
}

function getSubscriptionCurrentPeriodEndIso(
  subscription: Stripe.Subscription
): string | null {
  const subscriptionAny = subscription as Stripe.Subscription & {
    current_period_end?: number | null;
  };

  const itemPeriodEnd = subscription.items.data[0]?.current_period_end;
  const directPeriodEnd = subscriptionAny.current_period_end ?? null;

  const periodEndUnix =
    typeof itemPeriodEnd === "number"
      ? itemPeriodEnd
      : typeof directPeriodEnd === "number"
        ? directPeriodEnd
        : null;

  if (periodEndUnix === null) {
    return null;
  }

  return new Date(periodEndUnix * 1000).toISOString();
}

async function syncSubscriptionRecord(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  if (!customerId) {
    console.error("Subscription missing customer id:", subscription.id);
    throw new Error(`Subscription missing customer id: ${subscription.id}`);
  }

  const userId = await resolveUserIdFromCustomer(customerId);

  if (!userId) {
    console.error("No user found for stripe customer:", customerId);
    throw new Error(`No user found for stripe customer: ${customerId}`);
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const currentPeriodEnd = getSubscriptionCurrentPeriodEndIso(subscription);

  const payload = {
    id: subscription.id,
    user_id: userId,
    status: subscription.status,
    price_id: priceId,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("subscriptions").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    console.error("Failed to upsert subscription:", error);
    throw new Error(error.message || "Failed to upsert subscription");
  }
}

async function ensureStripeCustomerMapping(
  session: Stripe.Checkout.Session
): Promise<void> {
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const userId = session.metadata?.supabase_user_id ?? null;

  if (!customerId || !userId) {
    console.error("Missing customerId or userId in checkout.session.completed", {
      sessionId: session.id,
      customerId,
      userId,
    });
    throw new Error(
      `Missing customerId or userId in checkout.session.completed for session ${session.id}`
    );
  }

  const payload = {
    user_id: userId,
    stripe_customer_id: customerId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("stripe_customers").upsert(payload, {
    onConflict: "user_id",
  });

  if (error) {
    console.error("Failed to upsert stripe customer:", error);
    throw new Error(error.message || "Failed to upsert stripe customer");
  }
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    parent?: {
      subscription_details?: {
        subscription?: string | Stripe.Subscription | null;
      } | null;
    } | null;
  };

  const rawSubscription =
    invoiceWithSubscription.subscription ??
    invoiceWithSubscription.parent?.subscription_details?.subscription ??
    null;

  if (typeof rawSubscription === "string") {
    return rawSubscription;
  }

  if (
    rawSubscription &&
    typeof rawSubscription === "object" &&
    "id" in rawSubscription
  ) {
    return rawSubscription.id;
  }

  return null;
}

async function applySubscriptionCreditsFromInvoice(
  invoice: Stripe.Invoice,
  eventLivemode: boolean,
  eventId?: string
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;

  const subscriptionId = getInvoiceSubscriptionId(invoice);

  console.log("Invoice event received:", {
    eventId: eventId ?? null,
    invoiceId: invoice.id,
    livemode: eventLivemode,
    customerId,
    subscriptionId,
  });

  if (!customerId) {
    console.error("Invoice missing customer id:", invoice.id);
    throw new Error(`Invoice missing customer id: ${invoice.id}`);
  }

  if (!subscriptionId) {
    console.error("Invoice missing subscription id:", invoice.id);
    throw new Error(`Invoice missing subscription id: ${invoice.id}`);
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionRecord(subscription);

  const priceId = subscription.items.data[0]?.price?.id ?? null;

  if (!priceId) {
    console.error("Subscription missing price id:", subscription.id);
    throw new Error(`Subscription missing price id: ${subscription.id}`);
  }

  const credits = getCreditsForPrice(priceId);
  const userId = await resolveUserIdFromCustomer(customerId);

  console.log("Resolved invoice credit context:", {
    eventId: eventId ?? null,
    invoiceId: invoice.id,
    userId,
    priceId,
    credits,
  });

  if (!userId) {
    console.error("No user found for invoice customer:", customerId);
    throw new Error(`No user found for invoice customer: ${customerId}`);
  }

  if (credits <= 0) {
    console.error("No credits configured for price id:", priceId);
    throw new Error(`No credits configured for price id: ${priceId}`);
  }

  if (!eventLivemode && !allowTestCreditGrants) {
    console.log(
      "Skipping test-mode credit grant for invoice because STRIPE_ALLOW_TEST_CREDIT_GRANTS is false:",
      {
        eventId: eventId ?? null,
        invoiceId: invoice.id,
      }
    );
    return;
  }

  const invoiceAny = invoice as Stripe.Invoice & {
    billing_reason?: string | null;
  };

  const billingReason =
    typeof invoiceAny.billing_reason === "string"
      ? invoiceAny.billing_reason
      : null;

  const isRenewal = billingReason === "subscription_cycle";
  const referenceKey = `invoice_${invoice.id}`;

  const { error: applyError } = await supabase.rpc(
    "apply_subscription_credits",
    {
      p_user_id: userId,
      p_new_allowance: credits,
      p_reference_key: referenceKey,
      p_is_renewal: isRenewal,
    }
  );

  if (applyError) {
    console.error("Apply subscription credits failed:", {
      eventId: eventId ?? null,
      invoiceId: invoice.id,
      userId,
      priceId,
      credits,
      billingReason,
      isRenewal,
      error: applyError,
    });

    throw new Error(
      applyError.message || "Failed to apply subscription credits"
    );
  }

  console.log("Subscription credits applied successfully:", {
    eventId: eventId ?? null,
    invoiceId: invoice.id,
    userId,
    credits,
    billingReason,
    isRenewal,
    referenceKey,
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  const headerStore = await headers();
  const signature = headerStore.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("Stripe signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await ensureStripeCustomerMapping(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionRecord(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await applySubscriptionCreditsFromInvoice(
          invoice,
          event.livemode,
          event.id
        );
        break;
      }

      default: {
        console.log("Unhandled Stripe event type:", {
          eventId: event.id,
          type: event.type,
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler failed:", {
      eventId: event.id,
      type: event.type,
      error: err,
    });

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Webhook handler failed",
      },
      { status: 500 }
    );
  }
}