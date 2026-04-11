import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

type PlanKey = "essential" | "advanced" | "infinite" | "wonder" | null;

type SubscriptionRow = {
  id?: string | null;
  user_id?: string | null;
  status?: string | null;
  price_id?: string | null;
  plan?: string | null;
  plan_key?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  created_at?: string | null;
};

function normalizeValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function getConfiguredPriceMap() {
  return {
    essential:
      process.env.STRIPE_PRICE_ESSENTIAL_MONTHLY ||
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ESSENTIAL_MONTHLY ||
      "",
    advanced:
      process.env.STRIPE_PRICE_ADVANCED_MONTHLY ||
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ADVANCED_MONTHLY ||
      "",
    infinite:
      process.env.STRIPE_PRICE_INFINITE_MONTHLY ||
      process.env.NEXT_PUBLIC_STRIPE_PRICE_INFINITE_MONTHLY ||
      "",
    wonder:
      process.env.STRIPE_PRICE_STUDIO_MONTHLY ||
      process.env.NEXT_PUBLIC_STRIPE_PRICE_STUDIO_MONTHLY ||
      "",
  };
}

function resolvePlan(subscription: SubscriptionRow): PlanKey {
  const priceId = normalizeValue(subscription.price_id);
  const plan = normalizeValue(subscription.plan);
  const planKey = normalizeValue(subscription.plan_key);

  const priceMap = getConfiguredPriceMap();

  if (priceId) {
    if (priceId === normalizeValue(priceMap.essential)) return "essential";
    if (priceId === normalizeValue(priceMap.advanced)) return "advanced";
    if (priceId === normalizeValue(priceMap.infinite)) return "infinite";
    if (priceId === normalizeValue(priceMap.wonder)) return "wonder";
  }

  if (plan) {
    if (plan.includes("essential") || plan.includes("standard")) {
      return "essential";
    }
    if (plan.includes("advanced") || plan.includes("premium")) {
      return "advanced";
    }
    if (plan.includes("infinite") || plan.includes("ultimate")) {
      return "infinite";
    }
    if (
      plan.includes("wonder") ||
      plan.includes("studio") ||
      plan.includes("enterprise")
    ) {
      return "wonder";
    }
  }

  if (planKey) {
    if (planKey === "essential" || planKey === "standard") {
      return "essential";
    }
    if (planKey === "advanced" || planKey === "premium") {
      return "advanced";
    }
    if (planKey === "infinite" || planKey === "ultimate") {
      return "infinite";
    }
    if (
      planKey === "wonder" ||
      planKey === "studio" ||
      planKey === "enterprise"
    ) {
      return "wonder";
    }
  }

  return null;
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json(
        { error: userError.message || "Failed to get user." },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["trialing", "active", "past_due", "unpaid"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to fetch subscription." },
        { status: 500 }
      );
    }

    const subscription = (subscriptions?.[0] ?? null) as SubscriptionRow | null;

    if (!subscription) {
      return NextResponse.json({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    const plan = resolvePlan(subscription);

    console.log("[billing/current-subscription]", {
      userId: user.id,
      subscriptionId: subscription.id ?? null,
      priceId: subscription.price_id ?? null,
      planColumn: subscription.plan ?? null,
      planKeyColumn: subscription.plan_key ?? null,
      resolvedPlan: plan,
    });

    return NextResponse.json({
      currentPlan: plan,
      status: subscription.status ?? null,
      currentPeriodEnd: subscription.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    });
  } catch (err) {
    console.error("[billing/current-subscription] unexpected error:", err);

    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}