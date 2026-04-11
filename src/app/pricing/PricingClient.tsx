"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Lenis from "lenis";
import {
  BadgeHelp,
  CreditCard,
  CircleAlert,
  RefreshCw,
  Wallet,
  ChevronDown,
  Sparkles,
  Zap,
  Wand2,
  ArrowRight,
  Check,
  Gem,
  Layers3,
  Clapperboard,
  ScanSearch,
  BadgePlus,
  Film,
  Crown,
  Star,
} from "lucide-react";
import TopupButtons from "@/app/components/TopupButtons";
import { useAuth } from "@/app/components/providers/AuthProvider";

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
    icon: CreditCard,
  },
  {
    q: "Why Can't I Subscribe?",
    a: "Most common reasons: payment method blocked, region restrictions, or an existing subscription still active.",
    icon: CircleAlert,
  },
  {
    q: "Will I Be Automatically Charged by KOANimation?",
    a: "Subscriptions renew automatically until cancelled.",
    icon: RefreshCw,
  },
  {
    q: "Can I Get a Refund?",
    a: "Refunds should generally only apply to billing errors, not already consumed credits.",
    icon: Wallet,
  },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function useLenisScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const lenis = new Lenis({
      duration: 0.9,
      smoothWheel: true,
      touchMultiplier: 1.05,
    });

    let rafId = 0;

    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };

    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [enabled]);
}

function GlowDivider() {
  return (
    <div className="relative h-px w-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-400/20 to-transparent blur-sm" />
    </div>
  );
}

function SectionEyebrow({
  label,
  icon,
}: {
  label: string;
  icon?: ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/72 backdrop-blur-xl">
      {icon ?? (
        <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
      )}
      {label}
    </div>
  );
}

function GlassPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-xl",
        "shadow-[0_24px_90px_rgba(0,0,0,0.32)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),rgba(255,255,255,0.012)_22%,rgba(0,0,0,0.08)_100%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[23px] border border-white/[0.06]" />
      {children}
    </div>
  );
}

function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight || 1;
      setProgress((window.scrollY / max) * 100);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[3000] h-[2px]">
      <div
        className="h-full bg-[linear-gradient(to_right,rgba(168,85,247,0.95),rgba(59,130,246,0.95),rgba(34,211,238,0.95))] shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

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
        rgba(0,0,0,0) 42%,
        rgba(0,0,0,0.88) 72%,
        rgba(0,0,0,0.96) 100%)`
    : `rgba(0,0,0,0.92)`;

  return (
    <>
      <div className="fixed inset-0 -z-30">
        <img
          src={src}
          alt="Wallpaper"
          className="h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/12" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-20">
        <div className="absolute inset-0" style={{ background: spotlight }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.04)_0%,rgba(0,0,0,0.58)_55%,rgba(0,0,0,0.92)_100%)]" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[10%] top-[6%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.12),transparent_62%)] blur-3xl" />
        <div className="absolute right-[2%] top-[18%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.09),transparent_62%)] blur-3xl" />
        <div className="absolute left-[35%] bottom-[8%] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.05),transparent_62%)] blur-3xl" />
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
  if (!currentPlan) return "Subscribe Now";
  if (currentPlan === planKey) return "Current Plan";

  return PLAN_PRICES[planKey] > PLAN_PRICES[currentPlan]
    ? "Upgrade Plan"
    : "Downgrade Plan";
}

export default function PricingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, refreshCredits } = useAuth();

  useLenisScroll(true);

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("advanced");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

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

  const loadCurrentSubscription = useCallback(async () => {
    if (!user) {
      setCurrentSubscription({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      return null;
    }

    try {
      const res = await fetch("/api/billing/current-subscription", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load subscription");
      }

      const normalizedPlan = normalizePlanKey(data?.currentPlan);

      setCurrentSubscription({
        currentPlan: normalizedPlan,
        status: data?.status ?? null,
        currentPeriodEnd: data?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: Boolean(data?.cancelAtPeriodEnd),
      });

      return normalizedPlan;
    } catch (err) {
      console.error("[PricingClient] loadCurrentSubscription failed:", err);
      setCurrentSubscription({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      return null;
    }
  }, [user]);

  useEffect(() => {
    const planParam = normalizePlanKey(searchParams.get("plan"));
    if (planParam) {
      setSelectedPlan(planParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setCurrentSubscription({
        currentPlan: null,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      return;
    }

    void loadCurrentSubscription().then((currentPlan) => {
      const planParam = normalizePlanKey(searchParams.get("plan"));
      if (!planParam && currentPlan) {
        setSelectedPlan(currentPlan);
      }
    });
  }, [loading, user, loadCurrentSubscription, searchParams]);

  useEffect(() => {
    if (success && user) {
      void loadCurrentSubscription().then(async (currentPlan) => {
        const planParam = normalizePlanKey(searchParams.get("plan"));
        if (!planParam && currentPlan) {
          setSelectedPlan(currentPlan);
        }
        await refreshCredits();
      });
    }
  }, [success, user, searchParams, loadCurrentSubscription, refreshCredits]);

  const updatePricingUrl = (plan: PlanKey) => {
    router.replace(getPricingPath(plan), { scroll: false });
  };

  const handleSelectPlan = (plan: PlanKey) => {
    if (currentSubscription.currentPlan === plan) return;
    setSelectedPlan(plan);
    updatePricingUrl(plan);
  };

  const getLoginRedirectForPlan = useCallback(
    (plan?: PlanKey) => getPricingPath(plan ?? selectedPlan),
    [selectedPlan]
  );

  const goToLogin = useCallback(
    (redirectPath?: string) => {
      router.push(
        `/login?redirect=${encodeURIComponent(
          redirectPath ?? getLoginRedirectForPlan()
        )}`
      );
    },
    [router, getLoginRedirectForPlan]
  );

  const handleTryKoa = () => {
    if (loading) return;

    if (!user) {
      goToLogin("/tools");
      return;
    }

    router.push("/tools");
  };

  const handleManageSubscription = async () => {
    try {
      if (loading) return;

      if (!user) {
        goToLogin("/pricing");
        return;
      }

      if (!currentSubscription.currentPlan) {
        alert("You do not have an active paid subscription yet.");
        return;
      }

      setIsManagingBilling(true);

      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        credentials: "include",
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
    if (loading) return;
    if (currentSubscription.currentPlan === planKey) return;

    handleSelectPlan(planKey);

    if (!user) {
      goToLogin(getPricingPath(planKey));
      return;
    }

    const stripePlan = mapPlanKeyToStripePlan(planKey);

    try {
      setActiveCheckoutPlan(planKey);

      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          plan: stripePlan,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to start checkout.");
      }

      if (data?.updated) {
        const currentPlan = await loadCurrentSubscription();
        await refreshCredits();

        if (currentPlan) {
          setSelectedPlan(currentPlan);
          updatePricingUrl(currentPlan);
        }

        alert(
          data?.message ||
            "Plan updated successfully. Stripe will handle any prorated difference automatically."
        );
        return;
      }

      if (data?.alreadySubscribed) {
        const currentPlan = await loadCurrentSubscription();
        await refreshCredits();

        if (currentPlan) {
          setSelectedPlan(currentPlan);
          updatePricingUrl(currentPlan);
        }
        return;
      }

      if (!data?.url) {
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
        badge: "",
        glowClass:
          "border-[#9CC5FF]/25 shadow-[0_0_0_1px_rgba(156,197,255,0.12),0_0_32px_rgba(156,197,255,0.10),0_30px_80px_rgba(0,0,0,0.55)]",
        selectedGlowClass:
          "ring-2 ring-[#9CC5FF]/35 shadow-[0_0_0_1px_rgba(156,197,255,0.18),0_0_42px_rgba(156,197,255,0.18),0_30px_90px_rgba(0,0,0,0.6)]",
        currentGlowClass:
          "ring-2 ring-emerald-300/35 shadow-[0_0_0_1px_rgba(156,197,255,0.22),0_0_48px_rgba(156,197,255,0.22),0_30px_95px_rgba(0,0,0,0.62)]",
        auraClass:
          "bg-[radial-gradient(circle_at_top,rgba(156,197,255,0.18),transparent_42%)]",
        accentLine: "from-[#9CC5FF] to-[#d8e8ff]",
        icon: Sparkles,
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
        badge: "",
        glowClass:
          "border-[#EAD39A]/25 shadow-[0_0_0_1px_rgba(234,211,154,0.12),0_0_32px_rgba(234,211,154,0.10),0_30px_80px_rgba(0,0,0,0.55)]",
        selectedGlowClass:
          "ring-2 ring-[#EAD39A]/35 shadow-[0_0_0_1px_rgba(234,211,154,0.18),0_0_42px_rgba(234,211,154,0.18),0_30px_90px_rgba(0,0,0,0.6)]",
        currentGlowClass:
          "ring-2 ring-emerald-300/35 shadow-[0_0_0_1px_rgba(234,211,154,0.22),0_0_48px_rgba(234,211,154,0.22),0_30px_95px_rgba(0,0,0,0.62)]",
        auraClass:
          "bg-[radial-gradient(circle_at_top,rgba(234,211,154,0.18),transparent_42%)]",
        accentLine: "from-[#EAD39A] to-[#fff1cf]",
        icon: Wand2,
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
        badge: "Most popular",
        glowClass:
          "border-[#CDB7FF]/35 shadow-[0_0_0_1px_rgba(205,183,255,0.18),0_0_42px_rgba(205,183,255,0.20),0_35px_100px_rgba(0,0,0,0.62)]",
        selectedGlowClass:
          "ring-2 ring-[#CDB7FF]/45 shadow-[0_0_0_1px_rgba(205,183,255,0.25),0_0_56px_rgba(205,183,255,0.28),0_35px_110px_rgba(0,0,0,0.68)]",
        currentGlowClass:
          "ring-2 ring-emerald-300/35 shadow-[0_0_0_1px_rgba(205,183,255,0.28),0_0_62px_rgba(205,183,255,0.30),0_35px_115px_rgba(0,0,0,0.7)]",
        auraClass:
          "bg-[radial-gradient(circle_at_top,rgba(205,183,255,0.24),transparent_42%)]",
        accentLine: "from-[#CDB7FF] to-[#efe7ff]",
        icon: Zap,
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
        badge: "Best value",
        glowClass:
          "border-[#53D6FF]/30 shadow-[0_0_0_1px_rgba(83,214,255,0.14),0_0_36px_rgba(83,214,255,0.14),0_32px_90px_rgba(0,0,0,0.58)]",
        selectedGlowClass:
          "ring-2 ring-[#53D6FF]/40 shadow-[0_0_0_1px_rgba(83,214,255,0.20),0_0_50px_rgba(83,214,255,0.24),0_35px_105px_rgba(0,0,0,0.66)]",
        currentGlowClass:
          "ring-2 ring-emerald-300/35 shadow-[0_0_0_1px_rgba(83,214,255,0.24),0_0_60px_rgba(83,214,255,0.28),0_35px_115px_rgba(0,0,0,0.7)]",
        auraClass:
          "bg-[radial-gradient(circle_at_top,rgba(83,214,255,0.22),transparent_42%)]",
        accentLine: "from-[#53D6FF] to-[#d8f7ff]",
        icon: Gem,
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

  const compareRows = useMemo(
    () => [
      {
        label: "Monthly credits",
        values: [
          "4000 credits",
          "12000 credits",
          "24000 credits",
          "106000 credits",
        ],
      },
      {
        label: "Image generation",
        values: ["Included", "Included", "Included", "Included"],
      },
      {
        label: "Video generation",
        values: ["Included", "Included", "High-volume", "Studio-scale"],
      },
      {
        label: "Best for",
        values: [
          "Starters",
          "Growing creators",
          "Power users",
          "Teams & agencies",
        ],
      },
      {
        label: "Plan flexibility",
        values: [
          "Upgrade anytime",
          "Upgrade / downgrade",
          "Upgrade / downgrade",
          "Custom scaling later",
        ],
      },
    ],
    []
  );

  const currentPlanName = getPlanDisplayName(currentSubscription.currentPlan);

  return (
    <main className="relative min-h-screen overflow-x-hidden text-white">
      <ScrollProgress />
      <WallpaperRevealBackground src="/wallpaper.jpg" radius={240} />

      <header className="sticky top-0 z-[2000] px-6 pt-4">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between rounded-[26px] border border-white/10 bg-[linear-gradient(to_right,rgba(8,8,12,0.72),rgba(16,16,24,0.58),rgba(8,8,12,0.72))] px-5 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur transition duration-300 hover:border-white/15">
            <Link
              href="/"
              className="flex cursor-pointer items-center gap-3 md:gap-4"
              aria-label="Go to homepage"
            >
              <div className="relative -ml-2 flex h-[60px] w-[60px] items-center justify-center overflow-visible md:h-[68px] md:w-[68px]">
                <div className="relative h-[60px] w-[60px] -translate-y-[2px] md:h-[68px] md:w-[68px]">
                  <Image
                    src="/koanimationlogo.png"
                    alt="KOANimation logo"
                    fill
                    priority
                    className="object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.45)]"
                  />
                </div>
              </div>

              <div className="flex flex-col leading-none">
                <span className="text-[1.05rem] font-semibold tracking-tight text-white md:text-[1.1rem]">
                  KOANimation
                </span>
                <span className="mt-1 text-[11px] uppercase tracking-[0.24em] text-violet-200/55">
                  Pricing
                </span>
              </div>
            </Link>

            <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
              <Link className="transition hover:text-white" href="/#features">
                Features
              </Link>
              <Link className="transition hover:text-white" href="/#templates">
                Templates
              </Link>
              <Link className="transition hover:text-white" href="/pricing">
                Pricing
              </Link>
              <Link className="transition hover:text-white" href="/#resources">
                FAQ
              </Link>
            </div>

            <div className="flex items-center gap-3 text-sm">
              {!loading && user && currentSubscription.currentPlan ? (
                <button
                  type="button"
                  onClick={() => void handleManageSubscription()}
                  className="hidden cursor-pointer rounded-full border border-white/15 bg-white/5 px-4 py-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
                  disabled={isManagingBilling}
                >
                  {isManagingBilling ? "Opening..." : "Manage subscription"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleTryKoa}
                className="cursor-pointer rounded-full border border-white/15 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/15"
              >
                Try KOANimation
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden pt-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.0),rgba(0,0,0,0.58),rgba(0,0,0,0.96))]" />
          <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:64px_64px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pb-10">
          <div className="mx-auto max-w-4xl text-center">
            <SectionEyebrow
              label="Creator plans"
              icon={<Sparkles className="h-3.5 w-3.5 text-violet-300" />}
            />

            <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] md:text-6xl">
              Pricing that feels
              <span className="block bg-[linear-gradient(to_right,#ffffff,#ddd6fe,#7dd3fc)] bg-clip-text text-transparent">
                premium and scalable
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/65 md:text-base">
              Start lean, scale fast, and move into a true studio-level workflow
              when your output grows. Every plan is built for image and video
              generation with clear monthly credits.
            </p>
          </div>

          {!loading && (
            <div className="mt-7 text-center text-sm text-white/45">
              {user
                ? currentPlanName
                  ? `You are logged in as ${user.email ?? "your account"}. Current plan: ${currentPlanName}.`
                  : `You are logged in as ${user.email ?? "your account"}. You can subscribe or switch plans.`
                : "You can view pricing freely. Log in when you want to subscribe."}
            </div>
          )}

          {currentPlanName && (
            <div className="mx-auto mt-5 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/85 backdrop-blur-xl">
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
                className="ml-1 cursor-pointer rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isManagingBilling}
              >
                {isManagingBilling ? "Opening..." : "Manage"}
              </button>
            </div>
          )}

          {success && (
            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200 backdrop-blur-xl">
              Payment completed. Your subscription is being processed.
            </div>
          )}

          {canceled && (
            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-center text-sm text-yellow-200 backdrop-blur-xl">
              Checkout was canceled. You can still choose another plan anytime.
            </div>
          )}

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Faster creation",
                desc: "High-speed generation across every tier",
                icon: Zap,
              },
              {
                title: "Reference aware",
                desc: "More controlled consistency and identity",
                icon: ScanSearch,
              },
              {
                title: "Studio workflows",
                desc: "Built for serious creator pipelines",
                icon: Clapperboard,
              },
              {
                title: "Scales with output",
                desc: "Grow from regular use to agency volume",
                icon: BadgePlus,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <GlassPanel key={item.title} className="p-5">
                  <div className="relative z-10 flex items-start gap-4">
                    <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white/85">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/88">
                        {item.title}
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-white/55">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 lg:grid-cols-4">
            {plans.map((p) => {
              const isSelected =
                selectedPlan === p.key &&
                currentSubscription.currentPlan !== p.key;
              const isCurrent = currentSubscription.currentPlan === p.key;
              const isLoading = activeCheckoutPlan === p.key;
              const buttonLabel = getPlanActionLabel(
                p.key,
                currentSubscription.currentPlan
              );
              const Icon = p.icon;

              return (
                <div
                  key={p.key}
                  className={cn(
                    "group relative overflow-hidden rounded-3xl border bg-black/30 p-6 backdrop-blur-xl transition duration-300",
                    !isCurrent && "hover:-translate-y-1",
                    p.glowClass,
                    isSelected && p.selectedGlowClass,
                    isCurrent && p.currentGlowClass
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 transition duration-300",
                      p.auraClass,
                      isSelected || isCurrent ? "opacity-100" : "opacity-70"
                    )}
                  />

                  <div className="pointer-events-none absolute inset-[1px] rounded-[23px] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0.01)_20%,rgba(0,0,0,0.08)_100%)]" />

                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80",
                      p.accentLine
                    )}
                  />

                  {p.badge && !isCurrent ? (
                    <div className="absolute right-4 top-4 z-20 rounded-full bg-[#6B70FF] px-3 py-1 text-xs font-semibold text-white shadow-[0_0_18px_rgba(107,112,255,0.45)]">
                      {p.badge}
                    </div>
                  ) : null}

                  {isCurrent && (
                    <div className="absolute left-4 top-4 z-20 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 backdrop-blur-md">
                      Current Plan
                    </div>
                  )}

                  {!isCurrent && isSelected && (
                    <div className="absolute left-4 top-4 z-20 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                      Selected
                    </div>
                  )}

                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(p.key)}
                      className="absolute inset-0 z-0 cursor-pointer"
                      aria-label={`Select ${p.name}`}
                    />
                  )}

                  <div className="relative z-10 pt-10">
                    <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white/80">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-h-[52px]">
                      <div className="text-xl font-semibold leading-tight">
                        {p.name}
                      </div>
                    </div>

                    <div className="mt-4 flex items-end gap-2">
                      <div className="text-5xl font-semibold tracking-tight">
                        {p.price}$
                      </div>
                      <div className="pb-1 text-white/50">{p.suffix}</div>
                    </div>

                    <div className="mt-1 text-sm text-white/55">{p.sub}</div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handlePlanAction(p.key);
                    }}
                    disabled={isLoading || isCurrent || loading}
                    className={cn(
                      "relative z-10 mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                      isCurrent
                        ? "cursor-not-allowed border border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                        : cn("cursor-pointer", p.buttonStyle)
                    )}
                  >
                    {isLoading ? "Processing..." : buttonLabel}
                    {!isCurrent && (
                      <span className="ml-2 inline-flex align-middle text-white/60">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </button>

                  <div
                    className={cn(
                      "relative z-10 mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4",
                      p.creditBox.accent && "bg-[#3B3F64]/40"
                    )}
                  >
                    <div className="text-sm font-semibold text-white/88">
                      {p.creditBox.title}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {p.creditBox.sub}
                    </div>
                  </div>

                  <div className="relative z-10 mt-6 space-y-3 text-sm text-white/80">
                    {p.bullets.map((b) => (
                      <div key={b} className="flex gap-3">
                        <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70">
                          <Check className="h-3.5 w-3.5" />
                        </span>
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
          <GlassPanel className="overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.10),transparent_30%)]" />

            <div className="relative z-10 grid gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.9fr] lg:px-8 lg:py-10">
              <div>
                <SectionEyebrow
                  label="Credit top-ups"
                  icon={<BadgePlus className="h-3.5 w-3.5 text-cyan-300" />}
                />

                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
                  Need extra credits without changing your plan?
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 md:text-base">
                  Buy one-time credit packs whenever you need extra output.
                  Your monthly subscription credits still reset normally, while
                  purchased top-up credits stay on your account.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      title: "Flexible scaling",
                      desc: "Add more credits only when you need them.",
                    },
                    {
                      title: "Top-ups persist",
                      desc: "Purchased credits remain available through monthly resets.",
                    },
                    {
                      title: "Fast checkout",
                      desc: "Buy more credits instantly from Stripe checkout.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="text-sm font-semibold text-white/88">
                        {item.title}
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-white/55">
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white/85">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/88">
                      One-time credit packs
                    </div>
                    <div className="text-xs text-white/55">
                      Perfect for extra generations on demand
                    </div>
                  </div>
                </div>

                {!loading && user ? (
                  <TopupButtons />
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-relaxed text-white/65">
                      Log in first to purchase one-time credit packs and add
                      them directly to your KOANimation wallet.
                    </div>

                    <button
                      type="button"
                      onClick={() => goToLogin("/pricing")}
                      className="w-full cursor-pointer rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                      Log in to buy credits
                    </button>
                  </div>
                )}
              </div>
            </div>
          </GlassPanel>
        </div>
      </section>

      <section className="relative pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <SectionEyebrow
              label="Compare plans"
              icon={<Layers3 className="h-3.5 w-3.5 text-cyan-300" />}
            />
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
              Compare plans and features
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/65">
              A cleaner overview of monthly pricing and capacity so you can pick
              the right tier faster.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_24px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl">
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[220px_repeat(4,minmax(0,1fr))] border-b border-white/10 bg-black/30">
                  <div className="p-6">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/40">
                      Plans
                    </div>
                  </div>

                  {plans.map((plan) => {
                    const isSelected =
                      selectedPlan === plan.key &&
                      currentSubscription.currentPlan !== plan.key;
                    const isCurrent = currentSubscription.currentPlan === plan.key;

                    return (
                      <div
                        key={plan.key}
                        className={cn(
                          "relative p-6 text-center",
                          isSelected && "bg-white/[0.04]",
                          isCurrent && "bg-emerald-300/[0.06]"
                        )}
                      >
                        {(isSelected || isCurrent) && (
                          <div
                            className={cn(
                              "pointer-events-none absolute inset-x-6 top-0 h-px",
                              isCurrent
                                ? "bg-gradient-to-r from-emerald-300/0 via-emerald-300/80 to-emerald-300/0"
                                : "bg-gradient-to-r from-violet-300/0 via-violet-300/80 to-violet-300/0"
                            )}
                          />
                        )}

                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/65">
                          {isCurrent ? (
                            <>
                              <Crown className="h-3.5 w-3.5" />
                              Current
                            </>
                          ) : isSelected ? (
                            <>
                              <Star className="h-3.5 w-3.5" />
                              Selected
                            </>
                          ) : (
                            plan.name
                          )}
                        </div>

                        <div className="mt-4 text-xl font-semibold text-white">
                          {plan.name}
                        </div>
                        <div className="mt-2 flex items-end justify-center gap-2">
                          <span className="text-4xl font-semibold">
                            {plan.price}$
                          </span>
                          <span className="pb-1 text-white/45">/ month</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {compareRows.map((row, rowIndex) => (
                  <div
                    key={row.label}
                    className={cn(
                      "grid grid-cols-[220px_repeat(4,minmax(0,1fr))] border-b border-white/10 last:border-b-0",
                      rowIndex % 2 === 0 ? "bg-black/20" : "bg-black/30"
                    )}
                  >
                    <div className="p-6">
                      <div className="text-sm font-semibold text-white/85">
                        {row.label}
                      </div>
                    </div>

                    {row.values.map((value, index) => {
                      const plan = plans[index];
                      const isSelected =
                        selectedPlan === plan.key &&
                        currentSubscription.currentPlan !== plan.key;
                      const isCurrent = currentSubscription.currentPlan === plan.key;

                      return (
                        <div
                          key={`${row.label}-${plan.key}`}
                          className={cn(
                            "p-6 text-center text-sm text-white/75 transition",
                            isSelected && "bg-white/[0.03]",
                            isCurrent && "bg-emerald-300/[0.04]"
                          )}
                        >
                          {value}
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div className="grid grid-cols-[220px_repeat(4,minmax(0,1fr))] bg-black/35">
                  <div className="p-6">
                    <div className="text-sm font-semibold text-white/85">
                      Choose plan
                    </div>
                  </div>

                  {plans.map((plan) => {
                    const isCurrent = currentSubscription.currentPlan === plan.key;
                    const isLoading = activeCheckoutPlan === plan.key;
                    const buttonLabel = getPlanActionLabel(
                      plan.key,
                      currentSubscription.currentPlan
                    );

                    return (
                      <div key={plan.key} className="p-6">
                        <button
                          type="button"
                          onClick={() => void handlePlanAction(plan.key)}
                          disabled={isCurrent || isLoading || loading}
                          className={cn(
                            "w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                            isCurrent
                              ? "cursor-not-allowed border border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                              : cn("cursor-pointer", plan.buttonStyle)
                          )}
                        >
                          {isLoading ? "Processing..." : buttonLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
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
              <GlassPanel key={c.title} className="p-8 text-center">
                <div className="relative z-10">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/[0.03] text-xl backdrop-blur">
                    {c.icon}
                  </div>
                  <h3 className="mt-6 text-xl font-semibold">{c.title}</h3>
                  <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/65">
                    {c.desc}
                  </p>
                </div>
              </GlassPanel>
            ))}
          </div>
        </div>
      </section>

      <section className="relative pb-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <SectionEyebrow
              label="Need answers?"
              icon={<BadgeHelp className="h-3.5 w-3.5 text-violet-300" />}
            />
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
              Frequently asked questions
            </h2>
          </div>

          <GlassPanel className="mt-12 overflow-hidden">
            {FAQS.map((f, i) => {
              const open = faqOpen === i;
              const Icon = f.icon ?? BadgeHelp;

              return (
                <button
                  key={f.q}
                  type="button"
                  onClick={() => setFaqOpen(open ? null : i)}
                  className="group w-full cursor-pointer border-b border-white/10 px-6 py-6 text-left transition last:border-b-0 hover:bg-white/[0.03]"
                >
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.03] text-white/80 shadow-[0_0_20px_rgba(255,255,255,0.04)]">
                        <Icon size={18} strokeWidth={1.9} />
                      </span>
                      <span className="text-lg font-semibold text-white/92">
                        {f.q}
                      </span>
                    </div>

                    <span
                      className={cn(
                        "shrink-0 rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/60 transition duration-300",
                        open
                          ? "rotate-180 text-white"
                          : "group-hover:text-white/85"
                      )}
                    >
                      <ChevronDown size={18} strokeWidth={2} />
                    </span>
                  </div>

                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-out",
                      open
                        ? "mt-4 grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="pr-14 text-sm leading-relaxed text-white/65">
                        {f.a}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </GlassPanel>
        </div>
      </section>

      <section className="relative pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <GlassPanel className="overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_left,rgba(168,85,247,0.12),transparent_30%)]" />
            <div className="relative z-10 flex flex-col items-center justify-center px-6 py-14 text-center">
              <SectionEyebrow
                label="Start creating"
                icon={<Film className="h-3.5 w-3.5 text-cyan-300" />}
              />
              <h3 className="mt-5 text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                Choose your plan and create without friction
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/68 md:text-base">
                Upgrade when you need more output, manage billing anytime, and
                move into a more cinematic creation flow with KOANimation.
              </p>
              <button
                type="button"
                onClick={handleTryKoa}
                className="mt-7 cursor-pointer rounded-full border-0 bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_34px_rgba(37,99,235,0.26)] transition hover:bg-blue-500 hover:shadow-[0_0_50px_rgba(37,99,235,0.35)]"
              >
                Try KOANimation
              </button>
            </div>
          </GlassPanel>

          <div className="mt-10">
            <GlowDivider />
          </div>
        </div>
      </section>

      <footer className="pb-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 text-sm text-white/50">
          <span>© {new Date().getFullYear()} KOANimation</span>
          <div className="flex gap-4">
            <Link className="hover:text-white/80" href="/pricing">
              Pricing
            </Link>
            <button
              type="button"
              onClick={handleTryKoa}
              className="cursor-pointer hover:text-white/80"
            >
              Try KOANimation
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}