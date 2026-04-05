import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

function getPlanKeyFromPriceId(priceId: string | null) {
  if (!priceId) return null;

  switch (priceId) {
    case process.env.STRIPE_PRICE_ESSENTIAL_MONTHLY:
      return "standard";
    case process.env.STRIPE_PRICE_ADVANCED_MONTHLY:
      return "premium";
    case process.env.STRIPE_PRICE_INFINITE_MONTHLY:
      return "ultimate";
    case process.env.STRIPE_PRICE_STUDIO_MONTHLY:
      return "enterprise";
    default:
      return null;
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, status, price_id, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch subscription";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}