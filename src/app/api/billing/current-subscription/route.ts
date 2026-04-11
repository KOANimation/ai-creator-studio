import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

type PlanKey = "essential" | "advanced" | "infinite" | "wonder" | null;

// 🔥 MORE ROBUST
function resolvePlan(subscription: any): PlanKey {
  // 1. Try price_id
  switch (subscription?.price_id) {
    case process.env.NEXT_PUBLIC_STRIPE_PRICE_ESSENTIAL_MONTHLY:
      return "essential";
    case process.env.NEXT_PUBLIC_STRIPE_PRICE_ADVANCED_MONTHLY:
      return "advanced";
    case process.env.NEXT_PUBLIC_STRIPE_PRICE_INFINITE_MONTHLY:
      return "infinite";
    case process.env.NEXT_PUBLIC_STRIPE_PRICE_STUDIO_MONTHLY:
      return "wonder";
  }

  // 2. Fallback: plan column
  if (subscription?.plan) {
    const p = subscription.plan.toLowerCase();
    if (p.includes("essential")) return "essential";
    if (p.includes("advanced")) return "advanced";
    if (p.includes("infinite")) return "infinite";
    if (p.includes("wonder") || p.includes("studio")) return "wonder";
  }

  // 3. Fallback: plan_key column
  if (subscription?.plan_key) {
    const p = subscription.plan_key.toLowerCase();
    if (p === "essential") return "essential";
    if (p === "advanced") return "advanced";
    if (p === "infinite") return "infinite";
    if (p === "wonder" || p === "studio") return "wonder";
  }

  return null;
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

    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["trialing", "active", "past_due", "unpaid"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const subscription = subscriptions?.[0];

    if (!subscription) {
      return NextResponse.json({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    // 🔥 DEBUG (remove later)
    console.log("SUB:", subscription);

    const plan = resolvePlan(subscription);

    return NextResponse.json({
      currentPlan: plan,
      status: subscription.status ?? null,
      currentPeriodEnd: subscription.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}