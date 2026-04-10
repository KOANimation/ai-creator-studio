import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

type PlanKey = "essential" | "advanced" | "infinite" | "wonder" | null;

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
        {
          error: userError.message || "Failed to get user.",
        },
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
        "id, user_id, status, price_id, current_period_end, cancel_at_period_end, created_at"
      )
      .eq("user_id", user.id)
      .in("status", ["trialing", "active", "past_due", "unpaid"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (subscriptionError) {
      return NextResponse.json(
        {
          error: subscriptionError.message || "Failed to fetch subscription.",
        },
        { status: 500 }
      );
    }

    const subscription = subscriptions?.[0] ?? null;

    if (!subscription) {
      return NextResponse.json({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    return NextResponse.json({
      currentPlan: getPlanKeyFromPriceId(subscription.price_id),
      status: subscription.status ?? null,
      currentPeriodEnd: subscription.current_period_end ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch subscription";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}