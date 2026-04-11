"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, useCallback } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "@/app/components/providers/AuthProvider";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading, refreshAuth } = useAuth();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const redirect = useMemo(() => {
    const r = searchParams.get("next") || searchParams.get("redirect");
    return r && r.startsWith("/") ? r : "/tools";
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    router.replace(redirect);
    router.refresh();
  }, [authLoading, user, redirect, router]);

  const goHome = useCallback(() => {
    try {
      router.push("/");
      router.refresh();
    } catch {
      window.location.href = "/";
    }
  }, [router]);

  const goBack = useCallback(() => {
    try {
      router.push("/");
      router.refresh();
    } catch {
      window.location.href = "/";
    }
  }, [router]);

  const handleEmailAuth = useCallback(async () => {
    const cleanEmail = email.trim();
    const cleanInvitationCode = invitationCode.trim();

    if (!cleanEmail || !password) {
      alert("Please enter your email and password.");
      return;
    }

    setSubmitting(true);

    try {
      if (isSignup) {
        const emailRedirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}${redirect}`
            : undefined;

        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              invitationCode: cleanInvitationCode || null,
            },
            emailRedirectTo,
          },
        });

        if (error) {
          alert(error.message);
          return;
        }

        alert("Account created. Check your email to confirm your signup.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      await refreshAuth();
      router.replace(redirect);
      router.refresh();
    } catch (err) {
      console.error("Login/signup failed:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    email,
    invitationCode,
    isSignup,
    password,
    redirect,
    refreshAuth,
    router,
    supabase,
  ]);

  const handleGooglePlaceholder = useCallback(() => {
    alert("Google login comes next. For now use Continue with Email.");
  }, []);

  const handleApplePlaceholder = useCallback(() => {
    alert("Apple login comes later. For now use Continue with Email.");
  }, []);

  const isBusy = submitting;

  return (
    <div className="min-h-screen bg-[#070B12] text-white">
      <div className="relative min-h-screen">
        <div className="absolute inset-0">
          <video
            className="h-full w-full object-cover"
            src="/backgrounds/14.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_45%,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0.65)_55%,rgba(0,0,0,0.90)_100%)]" />
        </div>

        <div className="relative z-10 flex items-center justify-between px-8 py-7">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goHome}
              className="cursor-pointer rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-black/45"
              title="Home"
            >
              Home
            </button>

            <button
              type="button"
              onClick={goHome}
              className="group relative flex cursor-pointer items-center gap-3 rounded-2xl text-left transition hover:bg-white/[0.04] focus:outline-none"
              aria-label="Go to homepage"
            >
              <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <Image
                  src="/koanimationlogo.png"
                  alt="KOANimation"
                  fill
                  className="object-contain p-1 mix-blend-screen transition duration-300 group-hover:scale-[1.04]"
                />
              </div>

              <div className="text-lg font-semibold tracking-tight transition group-hover:text-white/90">
                KOANimation
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={goBack}
            className="cursor-pointer rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/15"
          >
            Back
          </button>
        </div>

        <div className="relative z-10 flex min-h-[calc(100vh-84px)] items-center justify-end px-8 pb-10">
          <div className="w-full max-w-[520px] rounded-3xl border border-white/10 bg-white/10 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.65)] backdrop-blur">
            <button
              type="button"
              onClick={goHome}
              className="mx-auto mb-6 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-black/25 transition hover:bg-black/35"
              aria-label="Go to homepage"
            >
              <div className="text-xl font-bold">K</div>
            </button>

            <h1 className="text-center text-3xl font-semibold">
              Log in or sign up for free!
            </h1>
            <p className="mt-2 text-center text-sm text-white/65">
              What you imagine is what KOANimation
            </p>

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={handleGooglePlaceholder}
                className={`w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 ${
                  isBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
                disabled={isBusy}
              >
                Continue with Google
              </button>

              <button
                type="button"
                onClick={handleApplePlaceholder}
                className={`w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 ${
                  isBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
                disabled={isBusy}
              >
                Continue with Apple
              </button>

              <button
                type="button"
                onClick={() => setShowEmailForm((prev) => !prev)}
                className={`w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 ${
                  isBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
                disabled={isBusy}
              >
                Continue with Email
              </button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/15" />
              <span className="text-xs text-white/50">&amp;</span>
              <div className="h-px flex-1 bg-white/15" />
            </div>

            {showEmailForm && (
              <div className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/25"
                  placeholder="Email address"
                  disabled={isBusy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isBusy) {
                      void handleEmailAuth();
                    }
                  }}
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/25"
                  placeholder="Password"
                  disabled={isBusy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isBusy) {
                      void handleEmailAuth();
                    }
                  }}
                />

                {isSignup && (
                  <input
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/25"
                    placeholder="Enter invitation code (optional)"
                    disabled={isBusy}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isBusy) {
                        void handleEmailAuth();
                      }
                    }}
                  />
                )}

                {!isSignup && (
                  <div className="text-right">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-white/60 transition hover:text-white"
                    >
                      Forgot your password?
                    </Link>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void handleEmailAuth()}
                  disabled={isBusy}
                  className={`w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 ${
                    isBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  }`}
                >
                  {isBusy
                    ? "Please wait..."
                    : isSignup
                      ? "Sign Up with Email"
                      : "Login with Email"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsSignup((prev) => !prev)}
                  disabled={isBusy}
                  className={`w-full text-sm text-white/70 underline underline-offset-2 transition hover:text-white ${
                    isBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  }`}
                >
                  {isSignup
                    ? "Already have an account? Log in"
                    : "Don't have an account yet? Sign up"}
                </button>
              </div>
            )}

            {!showEmailForm && (
              <input
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                className="mt-6 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/25"
                placeholder="Enter invitation code (optional)"
                disabled={isBusy}
              />
            )}

            <p className="mt-6 text-xs leading-relaxed text-white/55">
              By clicking a continue button, you confirm that you’ve read and
              agree to KOANimation’s{" "}
              <span className="underline underline-offset-2">Terms of Use</span>{" "}
              and{" "}
              <span className="underline underline-offset-2">
                Privacy Policy
              </span>.
            </p>

            <div className="mt-6 text-center text-xs text-white/45">
              Redirect after login:{" "}
              <span className="text-white/70">{redirect}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}