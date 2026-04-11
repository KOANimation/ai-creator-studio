"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Gem, Sparkles, Wallet, Zap } from "lucide-react";

type TopupKey = "1000" | "5000" | "15000" | "50000";

const PACKS: Array<{
  key: TopupKey;
  title: string;
  subtitle: string;
  accent: string;
  icon: typeof Sparkles;
}> = [
  {
    key: "1000",
    title: "1,000 credits",
    subtitle: "Quick boost for lighter generation",
    accent: "from-[#9CC5FF] to-[#d8e8ff]",
    icon: Sparkles,
  },
  {
    key: "5000",
    title: "5,000 credits",
    subtitle: "Great for regular top-ups",
    accent: "from-[#EAD39A] to-[#fff1cf]",
    icon: Zap,
  },
  {
    key: "15000",
    title: "15,000 credits",
    subtitle: "For bigger creative pushes",
    accent: "from-[#CDB7FF] to-[#efe7ff]",
    icon: Gem,
  },
  {
    key: "50000",
    title: "50,000 credits",
    subtitle: "High-volume studio boost",
    accent: "from-[#53D6FF] to-[#d8f7ff]",
    icon: Wallet,
  },
];

export default function TopupButtons() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loadingKey, setLoadingKey] = useState<TopupKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPathWithQuery = useMemo(() => {
    const query = searchParams?.toString();
    if (!pathname) return "/pricing";
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const handleBuy = async (topupKey: TopupKey) => {
    try {
      setError(null);
      setLoadingKey(topupKey);

      const res = await fetch("/api/stripe/create-topup-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          topupKey,
          redirectPath: currentPathWithQuery,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        router.push(
          `/login?redirect=${encodeURIComponent(currentPathWithQuery)}`
        );
        return;
      }

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to start top-up checkout session."
        );
      }

      if (!data?.url) {
        throw new Error("Stripe checkout URL was not returned.");
      }

      window.location.href = data.url;
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="space-y-3">
      {PACKS.map((pack) => {
        const Icon = pack.icon;
        const isLoading = loadingKey === pack.key;

        return (
          <button
            key={pack.key}
            type="button"
            onClick={() => void handleBuy(pack.key)}
            disabled={loadingKey !== null}
            className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${pack.accent} opacity-80`}
            />

            <div className="flex items-center gap-4">
              <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white/85">
                <Icon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white/90">
                  {pack.title}
                </div>
                <div className="mt-1 text-xs text-white/55">
                  {pack.subtitle}
                </div>
              </div>

              <div className="inline-flex items-center gap-2 text-sm font-semibold text-white/75 transition group-hover:text-white">
                {isLoading ? "Loading..." : "Buy now"}
                {!isLoading ? <ArrowRight className="h-4 w-4" /> : null}
              </div>
            </div>
          </button>
        );
      })}

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}