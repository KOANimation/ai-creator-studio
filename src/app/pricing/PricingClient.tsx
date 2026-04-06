"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

type PlanKey = "essential" | "advanced" | "infinite" | "wonder";

type CurrentSubscription = {
  currentPlan: PlanKey | null;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

const PLAN_PRICES: Record<PlanKey, number> = {
  essential: 14,
  advanced: 29,
  infinite: 56,
  wonder: 120,
};

const FAQS = [
  {
    q: "How to Subscribe?",
    a: "Choose a plan, click Subscribe, and complete checkout. Your credits refresh based on your plan cycle.",
  },
  {
    q: "Why Can't I Subscribe?",
    a: "Most common reasons: payment method blocked, region restrictions, or an existing subscription still active.",
  },
  {
    q: "Will I Be Automatically Charged by KOANimation?",
    a: "Subscriptions renew automatically until cancelled.",
  },
  {
    q: "Can I Get a Refund?",
    a: "Refunds should generally only apply to billing errors, not already consumed credits.",
  },
];

function WallpaperRevealBackground({
  src = "/wallpaper.jpg",
  radius = 240,
}: {
  src?: string;
  radius?: number;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setActive(true);
      setPos({ x: e.clientX, y: e.clientY });
    };

    const onLeave = () => setActive(false);

    const onTouch = (e: TouchEvent) => {
      const t = e.touches?.[0];
      if (!t) return;
      setActive(true);
      setPos({ x: t.clientX, y: t.clientY });
    };

    const onTouchEnd = () => setActive(false);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const spotlight = active
    ? `radial-gradient(circle ${radius}px at ${pos.x}px ${pos.y}px,
        rgba(0,0,0,0) 0%,
        rgba(0,0,0,0) 45%,
        rgba(0,0,0,0.90) 72%,
        rgba(0,0,0,0.96) 100%)`
    : `rgba(0,0,0,0.92)`;

  return (
    <>
      <div className="fixed inset-0 -z-20">
        <img
          src={src}
          alt="Wallpaper"
          className="h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: spotlight }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.90)_100%)]" />
      </div>
    </>
  );
}

function normalizePlanKey(value: string | null | undefined): PlanKey | null {
  if (!value) return null;

  switch (value.toLowerCase()) {
    case "essential":
    case "standard":
      return "essential";

    case "advanced":
    case "premium":
      return "advanced";

    case "infinite":
    case "ultimate":
      return "infinite";

    case "wonder":
    case "studio":
    case "enterprise":
      return "wonder";

    default:
      return null;
  }
}

function mapPlanKeyToStripePlan(
  planKey: PlanKey
): "essential" | "advanced" | "infinite" | "studio" {
  switch (planKey) {
    case "essential":
      return "essential";
    case "advanced":
      return "advanced";
    case "infinite":
      return "infinite";
    case "wonder":
      return "studio";
  }
}

function getPricingPath(plan: PlanKey) {
  return `/pricing?plan=${plan}`;
}

function getPlanDisplayName(plan: PlanKey | null) {
  switch (plan) {
    case "essential":
      return "Essential Plan";
    case "advanced":
      return "Advanced Plan";
    case "infinite":
      return "Infinite Plan";
    case "wonder":
      return "Wonder Plan";
    default:
      return null;
  }
}

function getPlanActionLabel(
  planKey: PlanKey,
  currentPlan: PlanKey | null
): string {
  if (!currentPlan) {
    return "Subscribe Now";
  }

  if (currentPlan === planKey) {
    return "Current Plan";
  }

  return PLAN_PRICES[planKey] > PLAN_PRICES[currentPlan]
    ? "Upgrade Plan"
    : "Downgrade Plan";
}

export default function PricingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("advanced");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeCheckoutPlan, setActiveCheckoutPlan] = useState<PlanKey | null>(
    null
  );
  const [isManagingBilling, setIsManagingBilling] = useState(false);
  const [currentSubscription, setCurrentSubscription] =
    useState<CurrentSubscription>({
      currentPlan: null,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });

  const success = searchParams.get("success") === "1";
  const canceled = searchParams.get("canceled") === "1";

  const loadCurrentSubscription = async () => {
    try {
      const res = await fetch("/api/billing/current-subscription", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load subscription");
      }

      setCurrentSubscription({
        currentPlan: normalizePlanKey(data.currentPlan),
        status: data.status ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      });
    } catch {
      setCurrentSubscription({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }
  };

  useEffect(() => {
    const planParam = normalizePlanKey(searchParams.get("plan"));
    if (planParam) {
      setSelectedPlan(planParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const planParam = normalizePlanKey(searchParams.get("plan"));

    if (!planParam && currentSubscription.currentPlan) {
      setSelectedPlan(currentSubscription.currentPlan);
    }
  }, [currentSubscription.currentPlan, searchParams]);

  useEffect(() => {
    const syncAuth = async () => {
      setMounted(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const authed = !!session;
      setIsAuthed(authed);

      if (authed) {
        await loadCurrentSubscription();
      }
    };

    void syncAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authed = !!session;
      setIsAuthed(authed);
      setMounted(true);

      if (authed) {
        await loadCurrentSubscription();
      } else {
        setCurrentSubscription({
          currentPlan: null,
          status: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (success && isAuthed) {
      void loadCurrentSubscription();
    }
  }, [success, isAuthed]);

  const updatePricingUrl = (plan: PlanKey) => {
    router.replace(getPricingPath(plan), { scroll: false });
  };

  const handleSelectPlan = (plan: PlanKey) => {
    setSelectedPlan(plan);
    updatePricingUrl(plan);
  };

  const goToLogin = () => {
    router.push(
      `/login?redirect=${encodeURIComponent(getPricingPath(selectedPlan))}`
    );
  };

  const handleTryKoa = () => {
    if (!isAuthed) {
      router.push(`/login?redirect=${encodeURIComponent("/tools")}`);
      return;
    }

    router.push("/tools");
  };

  const handleManageSubscription = async () => {
    try {
      if (!isAuthed) {
        router.push(`/login?redirect=${encodeURIComponent("/pricing")}`);
        return;
      }

      if (!currentSubscription.currentPlan) {
        alert("You do not have an active paid subscription yet.");
        return;
      }

      setIsManagingBilling(true);

      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to open billing portal.");
      }

      window.location.href = data.url;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to open billing portal.";
      alert(message);
    } finally {
      setIsManagingBilling(false);
    }
  };

  const handlePlanAction = async (planKey: PlanKey) => {
    handleSelectPlan(planKey);

    if (currentSubscription.currentPlan === planKey) {
      return;
    }

    const stripePlan = mapPlanKeyToStripePlan(planKey);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        goToLogin();
        return;
      }

      setActiveCheckoutPlan(planKey);

      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: stripePlan,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start checkout.");
      }

      if (data.updated) {
        await loadCurrentSubscription();
        alert(
          data.message ||
            "Plan updated successfully. Stripe will handle any prorated difference automatically."
        );
        return;
      }

      if (data.alreadySubscribed) {
        await loadCurrentSubscription();
        return;
      }

      if (!data.url) {
        throw new Error("No checkout URL returned.");
      }

      window.location.href = data.url;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      alert(message);
    } finally {
      setActiveCheckoutPlan(null);
    }
  };

  const plans = useMemo(
    () => [
      {
        key: "essential" as const,
        name: "Essential Plan",
        price: 14,
        suffix: "/ month",
        sub: "Monthly subscription",
        buttonStyle:
          "bg-[#9CC5FF] text-black hover:brightness-95 border border-white/10",
        highlight: false,
        badge: "",
        creditBox: {
          title: "4000 credits monthly",
          sub: "Starter creator plan",
        },
        bullets: [
          "4000 credits monthly",
          "Fast generation workflow",
          "Great for regular creators",
          "Image and video generation access",
          "Upgrade any time",
        ],
      },
      {
        key: "advanced" as const,
        name: "Advanced Plan",
        price: 29,
        suffix: "/ month",
        sub: "Monthly subscription",
        buttonStyle:
          "bg-[#EAD39A] text-black hover:brightness-95 border border-white/10",
        highlight: false,
        badge: "",
        creditBox: {
          title: "12000 credits monthly",
          sub: "For serious creators and teams",
        },
        bullets: [
          "12000 credits monthly",
          "Higher monthly output",
          "Better value per credit",
          "Image and video generation access",
          "Upgrade or downgrade any time",
        ],
      },
      {
        key: "infinite" as const,
        name: "Infinite Plan",
        price: 56,
        suffix: "/ month",
        sub: "Monthly subscription",
        buttonStyle:
          "bg-[#CDB7FF] text-black hover:brightness-95 border border-white/10",
        highlight: true,
        badge: "Most popular",
        creditBox: {
          title: "24000 credits monthly",
          sub: "Best for power users",
          accent: true,
        },
        bullets: [
          "24000 credits monthly",
          "Large monthly output",
          "Best creator-focused value",
          "High-volume image and video generation",
          "Upgrade or downgrade any time",
        ],
      },
      {
        key: "wonder" as const,
        name: "Wonder Plan",
        price: 120,
        suffix: "/ month",
        sub: "Monthly subscription",
        buttonStyle:
          "bg-[#53D6FF] text-black hover:brightness-95 border border-white/10",
        highlight: false,
        badge: "Best value",
        creditBox: {
          title: "106000 credits monthly",
          sub: "Studio-level usage and scaling",
        },
        bullets: [
          "106000 credits monthly",
          "Built for teams and agencies",
          "Large-scale generation workloads",
          "Priority support later",
          "Custom workflows later",
        ],
      },
    ],
    []
  );

  const comparePlans = useMemo(
    () => [
      { key: "essential" as const, name: "Essential Plan", price: 14 },
      { key: "advanced" as const, name: "Advanced Plan", price: 29 },
      { key: "infinite" as const, name: "Infinite Plan", price: 56 },
      { key: "wonder" as const, name: "Wonder Plan", price: 120 },
    ],
    []
  );

  const currentPlanName = getPlanDisplayName(currentSubscription.currentPlan);

  return (
    <main className="relative min-h-screen overflow-x-hidden text-white">
      <WallpaperRevealBackground src="/wallpaper.jpg" radius={240} />

      <header className="sticky top-0 z-[2000] border-b border-white/10 bg-black/45 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-semibold tracking-tight">
              KOANimation
            </Link>
            <span className="hidden text-sm text-white/35 md:block">
              Pricing
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm text-white/70">
            <Link className="hover:text-white" href="/#features">
              Features
            </Link>
            <Link className="hover:text-white" href="/#templates">
              Templates
            </Link>
            <Link className="hover:text-white" href="/pricing">
              Pricing
            </Link>

            {isAuthed && currentSubscription.currentPlan ? (
              <button
                type="button"
                onClick={() => void handleManageSubscription()}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isManagingBilling}
              >
                {isManagingBilling ? "Opening..." : "Manage subscription"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleTryKoa}
              className="ml-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white hover:bg-white/10"
            >
              Try KOANimation
            </button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden pt-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.65),rgba(0,0,0,1))]" />
          <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:60px_60px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pb-10 text-center">
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Choose the best plan for you
          </h1>

          <div className="mt-16 grid gap-10 md:grid-cols-5 md:gap-8">
            {[
              { label: "Ultra-Fast\nGeneration", icon: "⚡" },
              { label: "Multi-Reference\nConsistency", icon: "⬡" },
              { label: "Off-Peak\nMode", icon: "∞" },
              { label: "High-Quality\nVideo Generation", icon: "HD" },
              { label: "Smooth\n2D Animation", icon: "☺" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/[0.03] shadow-[0_0_40px_rgba(255,255,255,0.08)] backdrop-blur">
                  <span className="text-xl text-white/85">{f.icon}</span>
                </div>
                <div className="whitespace-pre-line text-center text-sm font-semibold text-white/85">
                  {f.label}
                </div>
              </div>
            ))}
          </div>

          {mounted && (
            <div className="mt-6 text-sm text-white/45">
              {isAuthed
                ? currentPlanName
                  ? `You are logged in. Current plan: ${currentPlanName}.`
                  : "You are logged in. You can subscribe or switch plans."
                : "You can view pricing freely. Log in when you want to subscribe."}
            </div>
          )}

          {currentPlanName && (
            <div className="mx-auto mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/85">
              <span>Current plan: {currentPlanName}</span>
              {currentSubscription.cancelAtPeriodEnd &&
                currentSubscription.currentPeriodEnd && (
                  <span className="text-white/55">
                    · ends{" "}
                    {new Date(
                      currentSubscription.currentPeriodEnd
                    ).toLocaleDateString()}
                  </span>
                )}
              <button
                type="button"
                onClick={() => void handleManageSubscription()}
                className="ml-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isManagingBilling}
              >
                {isManagingBilling ? "Opening..." : "Manage"}
              </button>
            </div>
          )}

          {success && (
            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Payment completed. Your subscription is being processed.
            </div>
          )}

          {canceled && (
            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              Checkout was canceled. You can still choose another plan anytime.
            </div>
          )}
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mt-10 grid gap-6 lg:grid-cols-4">
            {plans.map((p) => {
              const isSelected = selectedPlan === p.key;
              const isCurrent = currentSubscription.currentPlan === p.key;
              const isLoading = activeCheckoutPlan === p.key;
              const buttonLabel = getPlanActionLabel(
                p.key,
                currentSubscription.currentPlan
              );

              return (
                <div
                  key={p.key}
                  className={[
                    "relative overflow-hidden rounded-3xl border bg-black/16 p-6 backdrop-blur-xl transition",
                    p.highlight
                      ? "border-white/25 shadow-[0_0_0_1px_rgba(160,160,255,0.35),0_40px_140px_rgba(0,0,0,0.75)]"
                      : "border-white/10",
                    isSelected ? "ring-2 ring-white/30" : "",
                    isCurrent ? "ring-2 ring-emerald-300/35" : "",
                  ].join(" ")}
                >
                  {p.badge ? (
                    <div className="absolute right-4 top-4 z-20 rounded-full bg-[#6B70FF] px-3 py-1 text-xs font-semibold text-white">
                      {p.badge}
                    </div>
                  ) : null}

                  {isCurrent && (
                    <div className="absolute left-4 top-4 z-20 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                      Current Plan
                    </div>
                  )}

                  {!isCurrent && isSelected && (
                    <div className="absolute left-4 top-4 z-20 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                      Selected
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSelectPlan(p.key)}
                    className="absolute inset-0 z-0"
                    aria-label={`Select ${p.name}`}
                  />

                  <div className="relative z-10 min-h-[48px] pt-10">
                    <div className="text-xl font-semibold leading-tight">
                      {p.name}
                    </div>
                  </div>

                  <div className="relative z-10 mt-4 flex items-end gap-2">
                    <div className="text-5xl font-semibold tracking-tight">
                      {p.price}
                    </div>
                    <div className="pb-1 text-white/50">{p.suffix}</div>
                  </div>

                  <div className="relative z-10 mt-1 text-sm text-white/55">
                    {p.sub}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handlePlanAction(p.key);
                    }}
                    disabled={isLoading || isCurrent}
                    className={[
                      "relative z-10 mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                      p.buttonStyle,
                    ].join(" ")}
                  >
                    {isLoading ? "Processing..." : buttonLabel}
                    {!isCurrent && <span className="ml-2 text-white/60">›</span>}
                  </button>

                  <div
                    className={[
                      "relative z-10 mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4",
                      p.creditBox.accent ? "bg-[#3B3F64]/40" : "",
                    ].join(" ")}
                  >
                    <div className="text-sm font-semibold text-white/85">
                      {p.creditBox.title}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {p.creditBox.sub}
                    </div>
                  </div>

                  <div className="relative z-10 mt-6 space-y-3 text-sm text-white/80">
                    {p.bullets.map((b) => (
                      <div key={b} className="flex gap-2">
                        <span className="mt-[3px] text-white/60">✓</span>
                        <span className="text-white/80">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center text-4xl font-semibold tracking-tight md:text-5xl">
            Compare Plans and Features
          </h2>

          <div className="mt-12 overflow-hidden rounded-3xl border border-white/10 bg-black/16 backdrop-blur-xl">
            <div className="grid grid-cols-1 gap-px bg-white/10 md:grid-cols-5">
              <div className="bg-black/40 p-8 md:col-span-1">
                <div className="text-2xl font-semibold">Compare Plans</div>
              </div>

              {comparePlans.map((c) => {
                const isCurrent = currentSubscription.currentPlan === c.key;
                const isLoading = activeCheckoutPlan === c.key;
                const buttonLabel = getPlanActionLabel(
                  c.key,
                  currentSubscription.currentPlan
                );

                return (
                  <div
                    key={c.key}
                    className={[
                      "bg-black/40 p-8",
                      selectedPlan === c.key
                        ? "ring-1 ring-inset ring-white/20"
                        : "",
                      isCurrent ? "ring-1 ring-inset ring-emerald-300/35" : "",
                    ].join(" ")}
                  >
                    <div className="text-xl font-semibold">{c.name}</div>
                    <div className="mt-2 flex items-end gap-2">
                      <div className="text-5xl font-semibold">{c.price}</div>
                      <div className="pb-1 text-white/50">/ month</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handlePlanAction(c.key)}
                      disabled={isCurrent || isLoading}
                      className={[
                        "mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                        c.name === "Essential Plan"
                          ? "bg-[#9CC5FF] text-black hover:brightness-95"
                          : c.name === "Advanced Plan"
                            ? "bg-[#EAD39A] text-black hover:brightness-95"
                            : c.name === "Infinite Plan"
                              ? "bg-[#CDB7FF] text-black hover:brightness-95"
                              : "bg-[#53D6FF] text-black hover:brightness-95",
                      ].join(" ")}
                    >
                      {isLoading ? "Processing..." : buttonLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-black/16 backdrop-blur-xl">
            <div className="grid grid-cols-1 gap-px bg-white/10 md:grid-cols-5">
              <div className="bg-black/40 p-8 md:col-span-1">
                <div className="text-2xl font-semibold">Credits</div>
              </div>

              <div className="bg-black/40 p-8">
                <div className="text-white/80">4000 credits monthly</div>
              </div>

              <div className="bg-black/40 p-8">
                <div className="text-white/80">12000 credits monthly</div>
              </div>

              <div className="bg-black/40 p-8">
                <div className="text-white/80">24000 credits monthly</div>
              </div>

              <div className="bg-black/40 p-8">
                <div className="text-white/80">106000 credits monthly</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-16 md:grid-cols-3">
            {[
              {
                title: "Security & Private",
                icon: "🔒",
                desc:
                  "We prioritize protecting your financial data, personal information, and private details.",
              },
              {
                title: "Service Support",
                icon: "🎧",
                desc:
                  "Need assistance? Our support team is ready to resolve your queries.",
              },
              {
                title: "Trusted Worldwide",
                icon: "✈️",
                desc:
                  "Built for creators worldwide with scalable plans and flexible upgrades.",
              },
            ].map((c) => (
              <div key={c.title} className="text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/[0.03] text-xl backdrop-blur">
                  {c.icon}
                </div>
                <h3 className="mt-6 text-xl font-semibold">{c.title}</h3>
                <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/65">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative pb-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-4xl font-semibold tracking-tight md:text-5xl">
            Frequently Asked Questions
          </h2>

          <div className="mt-12 divide-y divide-white/10 rounded-3xl border border-white/10 bg-black/16 backdrop-blur-xl">
            {FAQS.map((f, i) => {
              const open = faqOpen === i;
              return (
                <button
                  key={f.q}
                  onClick={() => setFaqOpen(open ? null : i)}
                  className="w-full px-6 py-6 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/[0.02] text-white/80">
                        #
                      </span>
                      <span className="text-lg font-semibold">{f.q}</span>
                    </div>
                    <span className="text-2xl leading-none text-white/60">
                      {open ? "˄" : "˅"}
                    </span>
                  </div>

                  {open ? (
                    <div className="mt-4 text-sm leading-relaxed text-white/65">
                      {f.a}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 text-sm text-white/50">
          <span>© {new Date().getFullYear()} KOANimation</span>
          <div className="flex gap-4">
            <Link className="hover:text-white/80" href="/pricing">
              Pricing
            </Link>
            <button
              type="button"
              onClick={handleTryKoa}
              className="hover:text-white/80"
            >
              Try KOANimation
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}