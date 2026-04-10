import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

type TopupKey = "1000" | "5000" | "15000" | "50000";

function getTopupPriceId(topupKey: TopupKey): string | null {
  switch (topupKey) {
    case "1000":
      return process.env.STRIPE_TOPUP_1000_PRICE_ID ?? null;
    case "5000":
      return process.env.STRIPE_TOPUP_5000_PRICE_ID ?? null;
    case "15000":
      return process.env.STRIPE_TOPUP_15000_PRICE_ID ?? null;
    case "50000":
      return process.env.STRIPE_TOPUP_50000_PRICE_ID ?? null;
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const topupKey = body?.topupKey as TopupKey | undefined;

    if (!topupKey || !["1000", "5000", "15000", "50000"].includes(topupKey)) {
      return NextResponse.json(
        { error: "Invalid top-up selection" },
        { status: 400 }
      );
    }

    const priceId = getTopupPriceId(topupKey);

    if (!priceId) {
      return NextResponse.json(
        { error: "Missing Stripe price id for selected top-up" },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin || "";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/pricing?topup=success`,
      cancel_url: `${siteUrl}/pricing?topup=cancelled`,
      metadata: {
        supabase_user_id: user.id,
        purchase_type: "topup",
        topup_key: topupKey,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("create-topup-checkout-session failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create top-up checkout session",
      },
      { status: 500 }
    );
  }
}