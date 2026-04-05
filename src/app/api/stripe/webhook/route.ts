import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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

async function syncSubscriptionRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscription: Stripe.Subscription
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  if (!customerId) return;

  const priceId = subscription.items.data[0]?.price?.id ?? null;

  const { data: customerRow, error: customerError } = await supabase
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (customerError || !customerRow?.user_id) {
    console.error("Could not resolve stripe customer to user:", customerError);
    return;
  }

  const currentPeriodEnd =
    typeof subscription.items.data[0]?.current_period_end === "number"
      ? new Date(
          subscription.items.data[0].current_period_end * 1000
        ).toISOString()
      : null;

  const { error: upsertError } = await supabase.from("subscriptions").upsert({
    id: subscription.id,
    user_id: customerRow.user_id,
    status: subscription.status,
    price_id: priceId,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    created_at: new Date().toISOString(),
  });

  if (upsertError) {
    console.error("Failed to upsert subscription:", upsertError);
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
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      const userId = session.metadata?.supabase_user_id ?? null;

      if (customerId && userId) {
        const { error } = await supabase.from("stripe_customers").upsert({
          user_id: userId,
          stripe_customer_id: customerId,
        });

        if (error) {
          console.error("Failed to upsert stripe customer:", error);
        }
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionRecord(supabase, subscription);
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;

      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id ?? null;

      const rawSubscription = invoice.parent?.subscription_details?.subscription;
      const subscriptionId =
        typeof rawSubscription === "string" ? rawSubscription : null;

      if (!customerId || !subscriptionId) {
        return NextResponse.json({
          received: true,
          skipped: "Missing customer or subscription id",
        });
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      await syncSubscriptionRecord(supabase, subscription);

      const priceId = subscription.items.data[0]?.price?.id ?? null;

      if (!priceId) {
        return NextResponse.json({
          received: true,
          skipped: "Missing price id",
        });
      }

      const credits = getCreditsForPrice(priceId);

      if (credits > 0) {
        const { data: customer, error: customerError } = await supabase
          .from("stripe_customers")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (customerError) {
          console.error("Stripe customer lookup failed:", customerError);
        } else if (customer?.user_id) {
          const { error: grantError } = await supabase.rpc(
            "grant_credits_safe",
            {
              p_user_id: customer.user_id,
              p_amount: credits,
              p_source: "subscription",
              p_reference_key: `invoice_${invoice.id}`,
            }
          );

          if (grantError) {
            console.error("Grant credits failed:", grantError);
            return NextResponse.json(
              { error: grantError.message || "Failed to grant credits" },
              { status: 500 }
            );
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}