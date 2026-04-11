import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

type PlanKey = "essential" | "advanced" | "infinite" | "wonder" | null;

function normalizePlanKey(value: string | null | undefined): PlanKey {
  if (!value) return null;

  switch (String(value).toLowerCase()) {
    case "essential":
    case "standard":
      return "essential";
    case "advanced":
    case "premium":
      return "advanced";
    case "infinite":
    case "ultimate":
      return "infinite";
    case "wonder":
    case "studio":
    case "enterprise":
      return "wonder";
    default:
      return null;
  }
}

function getPlanKeyFromPriceId(priceId: string | null | undefined): PlanKey {
  if (!priceId) return null;

  switch (priceId) {
    case process.env.STRIPE_PRICE_ESSENTIAL_MONTHLY:
      return "essential";
    case process.env.STRIPE_PRICE_ADVANCED_MONTHLY:
      return "advanced";
    case process.env.STRIPE_PRICE_INFINITE_MONTHLY:
      return "infinite";
    case process.env.STRIPE_PRICE_STUDIO_MONTHLY:
      return "wonder";
    default:
      return null;
  }
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

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select(
        `
          id,
          user_id,
          status,
          price_id,
          current_period_end,
          cancel_at_period_end,
          created_at,
          updated_at,
          plan,
          plan_key
        `
      )
      .eq("user_id", user.id)
      .in("status", ["trialing", "active", "past_due", "unpaid"])
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(5);

    if (subscriptionError) {
      return NextResponse.json(
        {
          error:
            subscriptionError.message || "Failed to fetch subscription.",
        },
        { status: 500 }
      );
    }

    const subscription = subscriptions?.find((row) => {
      const byPriceId = getPlanKeyFromPriceId(row.price_id);
      const byPlanKey = normalizePlanKey(row.plan_key);
      const byPlan = normalizePlanKey(row.plan);
      return Boolean(byPriceId || byPlanKey || byPlan);
    }) ?? subscriptions?.[0] ?? null;

    if (!subscription) {
      return NextResponse.json({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    const resolvedPlan =
      getPlanKeyFromPriceId(subscription.price_id) ||
      normalizePlanKey(subscription.plan_key) ||
      normalizePlanKey(subscription.plan);

    return NextResponse.json({
      currentPlan: resolvedPlan,
      status: subscription.status ?? null,
      currentPeriodEnd: subscription.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch subscription";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}