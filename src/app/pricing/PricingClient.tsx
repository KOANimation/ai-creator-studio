"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
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
  const { user, loading, refreshCredits, refreshAuth } = useAuth();

  useLenisScroll(true);

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("advanced");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [activeCheckoutPlan, setActiveCheckoutPlan] = useState<PlanKey | null>(null);
  const [isManagingBilling, setIsManagingBilling] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription>({
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
      setSubscriptionLoading(false);
      return null;
    }

    setSubscriptionLoading(true);

    try {
      const res = await fetch("/api/billing/current-subscription", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

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
    } finally {
      setSubscriptionLoading(false);
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
      setSubscriptionLoading(false);
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
    const handlePageShow = () => {
      void refreshAuth();
      void loadCurrentSubscription();
      void refreshCredits();
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [loadCurrentSubscription, refreshAuth, refreshCredits]);

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
    [getLoginRedirectForPlan, router]
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

      const data = await res.json().catch(() => null);

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

      const data = await res.json().catch(() => null);

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

      {/* keep the rest of the JSX exactly the same as your current file */}
      {/* everything below this point can stay unchanged */}

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

          {(!loading || !subscriptionLoading) && (
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

          {/* keep the remainder of your pricing layout exactly as you already have it */}
        </div>
      </section>
    </main>
  );
}