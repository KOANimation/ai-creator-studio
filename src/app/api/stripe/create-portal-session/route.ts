import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/app/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: customerRow, error: customerError } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (customerError || !customerRow?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found for this user." },
        { status: 404 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerRow.stripe_customer_id,
      return_url: `${siteUrl}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create portal session";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}