import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/app/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

type IncomingPlan =
  | "essential"
  | "advanced"
  | "infinite"
  | "studio"
  | "wonder";

function getPriceId(plan: IncomingPlan) {
  switch (plan) {
    case "essential":
      return process.env.STRIPE_PRICE_ESSENTIAL_MONTHLY!;
    case "advanced":
      return process.env.STRIPE_PRICE_ADVANCED_MONTHLY!;
    case "infinite":
      return process.env.STRIPE_PRICE_INFINITE_MONTHLY!;
    case "studio":
    case "wonder":
      return process.env.STRIPE_PRICE_STUDIO_MONTHLY!;
    default:
      return null;
  }
}

function normalizePlan(plan: unknown): IncomingPlan | null {
  if (typeof plan !== "string") return null;

  switch (plan) {
    case "essential":
    case "advanced":
    case "infinite":
    case "studio":
    case "wonder":
      return plan;
    default:
      return null;
  }
}

function getSubscriptionCurrentPeriodEndIso(
  subscription: Stripe.Subscription
): string | null {
  const subscriptionAny = subscription as Stripe.Subscription & {
    current_period_end?: number | null;
  };

  const periodEndUnix =
    typeof subscriptionAny.current_period_end === "number"
      ? subscriptionAny.current_period_end
      : null;

  if (periodEndUnix === null) {
    return null;
  }

  return new Date(periodEndUnix * 1000).toISOString();
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const normalizedPlan = normalizePlan(body?.plan);

    if (!normalizedPlan) {
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 }
      );
    }

    const priceId = getPriceId(normalizedPlan);

    if (!priceId) {
      return NextResponse.json(
        { error: "Price not configured for selected plan" },
        { status: 500 }
      );
    }

    const { data: currentSubscription, error: currentSubscriptionError } =
      await supabaseAdmin
        .from("subscriptions")
        .select("id, status, price_id, cancel_at_period_end")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (currentSubscriptionError) {
      return NextResponse.json(
        {
          error:
            currentSubscriptionError.message ||
            "Failed to load current subscription",
        },
        { status: 500 }
      );
    }

    if (currentSubscription?.id) {
      if (currentSubscription.price_id === priceId) {
        return NextResponse.json({
          alreadySubscribed: true,
          message: "You are already on this plan.",
        });
      }

      const stripeSubscription = await stripe.subscriptions.retrieve(
        currentSubscription.id
      );

      const currentItem = stripeSubscription.items.data[0];

      if (!currentItem?.id) {
        return NextResponse.json(
          { error: "Could not find current subscription item." },
          { status: 500 }
        );
      }

      const updated = await stripe.subscriptions.update(currentSubscription.id, {
        items: [
          {
            id: currentItem.id,
            price: priceId,
          },
        ],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
      });

      const updatedPriceId = updated.items.data[0]?.price?.id ?? priceId;
      const currentPeriodEnd = getSubscriptionCurrentPeriodEndIso(updated);

      const { error: upsertError } = await supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            id: updated.id,
            user_id: user.id,
            status: updated.status,
            price_id: updatedPriceId,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: updated.cancel_at_period_end ?? false,
            created_at: new Date().toISOString(),
          },
          {
            onConflict: "id",
          }
        );

      if (upsertError) {
        return NextResponse.json(
          {
            error:
              upsertError.message || "Failed to save updated subscription",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        updated: true,
        message: "Subscription updated successfully.",
      });
    }

    let stripeCustomerId: string | null = null;

    const { data: existingCustomer, error: existingCustomerError } =
      await supabaseAdmin
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (existingCustomerError) {
      return NextResponse.json(
        {
          error:
            existingCustomerError.message ||
            "Failed to load Stripe customer mapping",
        },
        { status: 500 }
      );
    }

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      const { error: insertError } = await supabaseAdmin
        .from("stripe_customers")
        .upsert(
          {
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            created_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message || "Failed to save Stripe customer" },
          { status: 500 }
        );
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "Stripe customer could not be created" },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/pricing?success=1`,
      cancel_url: `${siteUrl}/pricing?canceled=1`,
      metadata: {
        supabase_user_id: user.id,
        plan: normalizedPlan,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: normalizedPlan,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create checkout session";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}