"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleUpdate = async () => {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password updated successfully.");
      setTimeout(() => router.push("/login"), 1500);
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur">
        <h1 className="text-xl font-semibold mb-4">Set New Password</h1>

        <input
          type="password"
          placeholder="New password"
          className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2 mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleUpdate}
          disabled={loading}
          className="w-full bg-white text-black rounded-lg py-2 font-semibold"
        >
          {loading ? "Updating..." : "Update password"}
        </button>

        {message && (
          <p className="mt-4 text-sm text-white/70">{message}</p>
        )}
      </div>
    </div>
  );
}