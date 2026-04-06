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
          debug: { step: "getUser" },
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
        debug: {
          reason: "No authenticated user found in route",
        },
      });
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select(
        "id, user_id, status, price_id, current_period_end, cancel_at_period_end, created_at"
      )
      .eq("user_id", user.id)
      .in("status", ["trialing", "active", "past_due", "unpaid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      return NextResponse.json(
        {
          error: subscriptionError.message || "Failed to fetch subscription.",
          debug: {
            userId: user.id,
            email: user.email ?? null,
            step: "subscription query",
          },
        },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        debug: {
          reason: "No matching subscription row found",
          userId: user.id,
          email: user.email ?? null,
        },
      });
    }

    return NextResponse.json({
      currentPlan: getPlanKeyFromPriceId(subscription.price_id),
      status: subscription.status ?? null,
      currentPeriodEnd: subscription.current_period_end ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      debug: {
        userId: user.id,
        email: user.email ?? null,
        subscriptionUserId: subscription.user_id,
        subscriptionId: subscription.id,
        priceId: subscription.price_id,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch subscription";

    return NextResponse.json(
      {
        error: message,
        debug: { step: "catch" },
      },
      { status: 500 }
    );
  }
}