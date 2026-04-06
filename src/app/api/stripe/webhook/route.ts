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

async function resolveUserIdFromCustomer(customerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    console.error("Could not resolve stripe customer to user:", error);
    return null;
  }

  return data?.user_id ?? null;
}

async function syncSubscriptionRecord(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  if (!customerId) {
    console.error("Subscription missing customer id:", subscription.id);
    return;
  }

  const userId = await resolveUserIdFromCustomer(customerId);

  if (!userId) {
    console.error("No user found for stripe customer:", customerId);
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;

  const currentPeriodEnd =
    typeof subscription.items.data[0]?.current_period_end === "number"
      ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
      : null;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      id: subscription.id,
      user_id: userId,
      status: subscription.status,
      price_id: priceId,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      created_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
    }
  );

  if (error) {
    console.error("Failed to upsert subscription:", error);
  }
}

async function ensureStripeCustomerMapping(session: Stripe.Checkout.Session) {
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const userId = session.metadata?.supabase_user_id ?? null;

  if (!customerId || !userId) {
    console.error("Missing customerId or userId in checkout.session.completed", {
      customerId,
      userId,
      sessionId: session.id,
    });
    return;
  }

  const { error } = await supabase.from("stripe_customers").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      created_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    console.error("Failed to upsert stripe customer:", error);
  }
}

async function grantCreditsFromInvoice(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;

  if (!customerId) {
    console.error("Invoice missing customer id:", invoice.id);
    return;
  }

  const rawSubscription = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof rawSubscription === "string" ? rawSubscription : null;

  if (!subscriptionId) {
    console.error("Invoice missing subscription id:", invoice.id);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionRecord(subscription);

  const priceId = subscription.items.data[0]?.price?.id ?? null;

  if (!priceId) {
    console.error("Subscription missing price id:", subscription.id);
    return;
  }

  const credits = getCreditsForPrice(priceId);

  if (credits <= 0) {
    console.error("No credits configured for price id:", priceId);
    return;
  }

  const userId = await resolveUserIdFromCustomer(customerId);

  if (!userId) {
    console.error("No user found for invoice customer:", customerId);
    return;
  }

  const referenceKey = `invoice_${invoice.id}`;

  const { error: grantError } = await supabase.rpc("grant_credits_safe", {
    p_user_id: userId,
    p_amount: credits,
    p_source: "subscription",
    p_reference_key: referenceKey,
  });

  if (grantError) {
    console.error("Grant credits failed:", grantError);
    throw new Error(grantError.message || "Failed to grant credits");
  }
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

      case "invoice.paid":
      case "invoice_payment.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await grantCreditsFromInvoice(invoice);
        break;
      }

      default: {
        console.log("Unhandled Stripe event type:", event.type);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook handler failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook handler failed" },
      { status: 500 }
    );
  }
}