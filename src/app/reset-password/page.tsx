"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const initRecoverySession = async () => {
      try {
        setBootLoading(true);
        setErrorMessage(null);

        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;

        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");
        const code = queryParams.get("code");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          if (type && type !== "recovery") {
            throw new Error("This password reset link is invalid.");
          }

          setSessionReady(true);
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          setSessionReady(true);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setSessionReady(true);
          return;
        }

        throw new Error(
          "This reset link is invalid or expired. Please request a new one."
        );
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Could not verify reset link."
        );
        setSessionReady(false);
      } finally {
        setBootLoading(false);
      }
    };

    void initRecoverySession();
  }, [supabase]);

  const handleUpdate = async () => {
    if (!password.trim()) {
      setErrorMessage("Please enter a new password.");
      setMessage(null);
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      setMessage(null);
      return;
    }

    setLoading(true);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage("Password updated successfully. Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#070B12] text-white">
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.65)] backdrop-blur">
          <h1 className="text-3xl font-semibold">Set a new password</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            Enter your new password below.
          </p>

          <div className="mt-6 space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={bootLoading || !sessionReady}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="New password"
            />

            <button
              type="button"
              onClick={handleUpdate}
              disabled={loading || bootLoading || !sessionReady}
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {bootLoading
                ? "Verifying reset link..."
                : loading
                  ? "Updating..."
                  : "Update password"}
            </button>

            {message && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {message}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}