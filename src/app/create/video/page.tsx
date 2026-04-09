import { Suspense } from "react";
import { redirect } from "next/navigation";
import CreateVideoClient from "./CreateVideoClient";
import { createClient } from "@/app/lib/supabase/server";

function CreateVideoFallback() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-[1500px] items-center justify-center px-6 py-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm text-white/70 backdrop-blur-xl">
          Loading video workspace...
        </div>
      </div>
    </div>
  );
}

export default async function CreateVideoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 🔐 Redirect if not logged in
  if (!user) {
    redirect("/login?redirect=%2Fcreate%2Fvideo%3Ftab%3Dreference-to-video");
  }

  // 💰 Get user credits safely (no crash if row missing)
  const { data: wallet, error } = await supabase
    .from("credit_wallets")
    .select("balance")
    .eq("user_id", user.id)
    .maybeSingle(); // ✅ safer than .single()

  const initialCredits = wallet?.balance ?? 0;

  return (
    <Suspense fallback={<CreateVideoFallback />}>
      <CreateVideoClient initialCredits={initialCredits} />
    </Suspense>
  );
}