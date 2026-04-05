"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleReset = async () => {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email for the reset link.");
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur">
        <h1 className="text-xl font-semibold mb-4">Reset Password</h1>

        <input
          type="email"
          placeholder="Your email"
          className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2 mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          onClick={handleReset}
          disabled={loading}
          className="w-full bg-white text-black rounded-lg py-2 font-semibold"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>

        {message && (
          <p className="mt-4 text-sm text-white/70">{message}</p>
        )}
      </div>
    </div>
  );
}