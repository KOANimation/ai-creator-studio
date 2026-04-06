"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Particles from "react-tsparticles";
import type { Engine } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";
import FloatingMediaWall from "./components/FloatingMediaWall";
import { getCurrentUser } from "@/app/lib/supabase/session";

function GlowDivider() {
  return (
    <div className="relative h-px w-full">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

async function isLoggedIn(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

function useAuthNavigate() {
  const router = useRouter();

  return useCallback(
    async (targetHref: string) => {
      const loggedIn = await isLoggedIn();

      if (loggedIn) {
        router.push(targetHref);
      } else {
        router.push(`/login?redirect=${encodeURIComponent(targetHref)}`);
      }
    },
    [router]
  );
}

function AuthMenuItem({ href, label }: { href: string; label: string }) {
  const go = useAuthNavigate();

  return (
    <button
      type="button"
      onClick={() => go(href)}
      className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-[13px] text-white/75 transition hover:bg-white/5 hover:text-white"
    >
      <span>{label}</span>
      <span className="text-white/30">→</span>
    </button>
  );
}

function AuthCTAButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const go = useAuthNavigate();

  return (
    <button
      type="button"
      onClick={() => go(href)}
      className={[
        "cursor-pointer rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15",
        className,
      ].join(" ")}
    >
      {children}
    </button>
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
        rgba(0,0,0,0) 45%,
        rgba(0,0,0,0.90) 72%,
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
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-20">
        <div className="absolute inset-0" style={{ background: spotlight }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.90)_100%)]" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-10 opacity-70">
        <div className="absolute -left-24 top-20 h-[380px] w-[380px] rounded-full bg-violet-600/20 blur-[140px]" />
        <div className="absolute right-[-80px] top-[20%] h-[340px] w-[340px] rounded-full bg-blue-500/15 blur-[140px]" />
        <div className="absolute bottom-[-80px] left-[20%] h-[260px] w-[260px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
      </div>
    </>
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
        className="h-full bg-[linear-gradient(to_right,rgba(168,85,247,0.95),rgba(59,130,246,0.95),rgba(34,211,238,0.95))] shadow-[0_0_20px_rgba(168,85,247,0.45)] transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[8%] top-[18%] h-4 w-4 animate-pulse rounded-full bg-violet-400/50 blur-[1px]" />
      <div className="absolute right-[15%] top-[28%] h-3 w-3 animate-pulse rounded-full bg-cyan-400/50 blur-[1px]" />
      <div className="absolute left-[20%] top-[58%] h-2.5 w-2.5 animate-pulse rounded-full bg-blue-400/50 blur-[1px]" />
      <div className="absolute right-[28%] top-[62%] h-4 w-4 animate-pulse rounded-full bg-fuchsia-400/40 blur-[1px]" />
      <div className="absolute bottom-[18%] left-[48%] h-3 w-3 animate-pulse rounded-full bg-white/30 blur-[1px]" />
    </div>
  );
}

function VideoCarousel({
  items,
  initialIndex = 0,
}: {
  items: { title: string; src: string }[];
  initialIndex?: number;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const active = items[idx];

  const prev = () => setIdx((i) => (i - 1 + items.length) % items.length);
  const next = () => setIdx((i) => (i + 1) % items.length);
  const at = (i: number) => (i + items.length) % items.length;

  return (
    <div className="relative">
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_40px_140px_rgba(0,0,0,0.65)] backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.15),transparent_30%)]" />
          <video
            key={active.src}
            className="h-[260px] w-full object-cover sm:h-[360px] md:h-[460px]"
            src={active.src}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.06)_0%,rgba(0,0,0,0.55)_62%,rgba(0,0,0,0.88)_100%)]" />

          <div className="pointer-events-none absolute left-5 top-5 z-20 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
            Reference-to-Video Showcase
          </div>

          <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 w-[min(92%,560px)] -translate-x-1/2">
            <div className="pointer-events-auto flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-3 py-3 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur">
              {[at(idx - 1), at(idx), at(idx + 1)].map((realIndex) => {
                const isActive = realIndex === idx;
                return (
                  <button
                    key={items[realIndex].src}
                    onClick={() => setIdx(realIndex)}
                    aria-label={`Select ${items[realIndex].title}`}
                    className={[
                      "relative overflow-hidden rounded-xl border transition",
                      "focus:outline-none focus:ring-2 focus:ring-white/20",
                      isActive
                        ? "border-white/25 ring-1 ring-white/15"
                        : "border-white/10 hover:border-white/20",
                    ].join(" ")}
                  >
                    <video
                      className="h-14 w-24 object-cover sm:h-16 sm:w-28"
                      src={items[realIndex].src}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-black/10" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          aria-label="Previous"
          onClick={prev}
          className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-3 text-white/90 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/20 md:-left-10 md:p-4"
        >
          <span className="text-2xl leading-none md:text-3xl">‹</span>
        </button>

        <button
          aria-label="Next"
          onClick={next}
          className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-3 text-white/90 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/20 md:-right-10 md:p-4"
        >
          <span className="text-2xl leading-none md:text-3xl">›</span>
        </button>

        <div className="mt-5 text-center text-white/65">
          <span className="text-sm">{active.title}</span>
        </div>
      </div>
    </div>
  );
}

function ImageToVideoCarousel({
  items,
  initialIndex = 0,
}: {
  items: { title: string; src: string }[];
  initialIndex?: number;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const active = items[idx];

  const prev = () => setIdx((i) => (i - 1 + items.length) % items.length);
  const next = () => setIdx((i) => (i + 1) % items.length);

  const leftThumb = items[(idx - 1 + items.length) % items.length];
  const rightThumb = items[(idx + 1) % items.length];

  return (
    <div className="relative">
      <div className="relative mx-auto w-full max-w-6xl">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_50px_160px_rgba(0,0,0,0.70)] backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.16),transparent_28%)]" />
          <video
            key={active.src}
            className="h-[340px] w-full object-cover sm:h-[440px] md:h-[520px]"
            src={active.src}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.035)_0%,rgba(0,0,0,0.46)_58%,rgba(0,0,0,0.90)_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />

          <div className="pointer-events-none absolute left-5 top-5 z-20 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
            Image-to-Video Showcase
          </div>

          <div className="pointer-events-none absolute bottom-6 right-7 text-sm font-semibold tracking-tight text-white/35">
            KOANimation
          </div>

          <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 w-[min(92%,520px)] -translate-x-1/2">
            <div className="pointer-events-auto flex items-center justify-center gap-4 rounded-[18px] border border-white/10 bg-black/50 px-4 py-3 shadow-[0_22px_95px_rgba(0,0,0,0.62)] backdrop-blur">
              <button
                onClick={prev}
                aria-label="Select previous"
                className="relative overflow-hidden rounded-xl border border-white/10 transition hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <video
                  className="h-[58px] w-[132px] object-cover"
                  src={leftThumb.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="pointer-events-none absolute inset-0 bg-black/15" />
              </button>

              <div className="flex items-center gap-0.5 text-white/35">
                <span className="text-[26px] leading-none">›</span>
                <span className="text-[26px] leading-none">›</span>
                <span className="text-[26px] leading-none">›</span>
                <span className="text-[26px] leading-none">›</span>
              </div>

              <button
                onClick={next}
                aria-label="Select next"
                className="relative overflow-hidden rounded-xl border border-white/10 transition hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <video
                  className="h-[58px] w-[132px] object-cover"
                  src={rightThumb.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="pointer-events-none absolute inset-0 bg-black/15" />
              </button>
            </div>
          </div>
        </div>

        <button
          aria-label="Previous"
          onClick={prev}
          className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-3 text-white/90 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/20 md:-left-12 md:p-4"
        >
          <span className="text-2xl leading-none md:text-3xl">‹</span>
        </button>

        <button
          aria-label="Next"
          onClick={next}
          className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-3 text-white/90 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/20 md:-right-12 md:p-4"
        >
          <span className="text-2xl leading-none md:text-3xl">›</span>
        </button>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  desc,
  mediaSrc,
  ctaHref,
  ctaLabel,
  glowClass,
  badge,
}: {
  title: string;
  desc: string;
  mediaSrc: string;
  ctaHref: string;
  ctaLabel: string;
  glowClass: string;
  badge: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur",
        "shadow-[0_30px_110px_rgba(0,0,0,0.45)]",
        glowClass,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0.01)_22%,rgba(0,0,0,0.08)_100%)]" />
      <div className="pointer-events-none absolute -top-10 left-8 h-28 w-28 rounded-full bg-white/10 blur-3xl opacity-40" />

      <div className="relative z-10 flex items-start justify-between gap-6">
        <div className="max-w-md">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-white/25" />
            {badge}
          </div>
          <h3 className="text-xl font-semibold text-white md:text-2xl">
            {title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-white/70">{desc}</p>

          <Link
            href={ctaHref}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-5 py-2.5 text-sm font-semibold text-white/85 backdrop-blur transition hover:bg-black/50"
          >
            {ctaLabel} <span className="text-lg leading-none">→</span>
          </Link>
        </div>

        <div className="relative hidden w-[260px] shrink-0 md:block">
          <div className="absolute -inset-10 rounded-[40px] bg-white/10 blur-3xl opacity-25" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <video
              className="h-[160px] w-full object-cover"
              src={mediaSrc}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FAQItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-left transition hover:bg-white/[0.07] backdrop-blur"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-white/90 sm:text-base">
          {q}
        </span>
        <span className="text-xl leading-none text-white/60">
          {open ? "–" : "+"}
        </span>
      </div>
      {open && (
        <div className="mt-3 text-sm leading-relaxed text-white/70">{a}</div>
      )}
    </button>
  );
}

function ToolModeCard({
  title,
  desc,
  href,
  accentClass,
}: {
  title: string;
  desc: string;
  href: string;
  accentClass: string;
}) {
  const go = useAuthNavigate();

  return (
    <button
      type="button"
      onClick={() => go(href)}
      className={[
        "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur transition",
        "hover:border-white/20 hover:bg-white/[0.07]",
        accentClass,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0.01)_20%,rgba(0,0,0,0.08)_100%)]" />
      <div className="pointer-events-none absolute -right-8 top-0 h-20 w-20 rounded-full bg-white/10 blur-2xl opacity-20 transition group-hover:opacity-35" />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="text-base font-semibold text-white">{title}</div>
          <div className="text-white/30 transition group-hover:text-white/60">
            →
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-white/65">{desc}</p>
      </div>
    </button>
  );
}

function MetricCard({
  value,
  label,
  glow,
}: {
  value: string;
  label: string;
  glow: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur",
        glow,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0.01)_24%,rgba(0,0,0,0.08)_100%)]" />
      <div className="relative z-10">
        <div className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {value}
        </div>
        <div className="mt-2 text-sm text-white/60">{label}</div>
      </div>
    </div>
  );
}

function BentoCard({
  title,
  desc,
  mediaSrc,
  badge,
  glowClass,
  tall = false,
}: {
  title: string;
  desc: string;
  mediaSrc: string;
  badge: string;
  glowClass: string;
  tall?: boolean;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur",
        "shadow-[0_24px_90px_rgba(0,0,0,0.35)]",
        glowClass,
        tall ? "md:row-span-2" : "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.045),rgba(255,255,255,0.01)_25%,rgba(0,0,0,0.08)_100%)]" />
      <div className="relative z-10 flex h-full flex-col">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
          <span className="h-2 w-2 rounded-full bg-white/25" />
          {badge}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <video
            className={tall ? "h-[300px] w-full object-cover md:h-[420px]" : "h-[220px] w-full object-cover"}
            src={mediaSrc}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
          />
        </div>

        <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/65">{desc}</p>
      </div>
    </div>
  );
}

function MarqueeRow({ items }: { items: string[] }) {
  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 py-3 backdrop-blur">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-black/90 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-black/90 to-transparent" />
      <div className="animate-[marquee_28s_linear_infinite] whitespace-nowrap">
        {doubled.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="mx-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70"
          >
            {item}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}

function StudioTimeline({
  items,
}: {
  items: { step: string; title: string; desc: string; glow: string }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.step}
          className={[
            "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur",
            item.glow,
          ].join(" ")}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.045),rgba(255,255,255,0.01)_22%,rgba(0,0,0,0.08)_100%)]" />
          <div className="relative z-10">
            <div className="inline-flex rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60">
              {item.step}
            </div>
            <div className="mt-4 text-lg font-semibold text-white">
              {item.title}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              {item.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function HoverSpotlightSection({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStyle({
      background: `radial-gradient(circle 240px at ${x}px ${y}px, rgba(168,85,247,0.10), rgba(59,130,246,0.06) 35%, transparent 70%)`,
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className="relative overflow-hidden rounded-[36px]"
    >
      <div className="pointer-events-none absolute inset-0 transition duration-150" style={style} />
      {children}
    </div>
  );
}

export default function Home() {
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const showcase = useMemo(
    () => [
      { title: "OVA Noir — Nighttime Talk", src: "/backgrounds/12.mp4" },
      { title: "Fairy Fountain Dive", src: "/backgrounds/2.mp4" },
      { title: "The Last Hunt", src: "/backgrounds/3.mp4" },
      { title: "Sensual Reunion", src: "/backgrounds/4.mp4" },
      { title: "Silver for Monsters", src: "/backgrounds/5.mp4" },
      { title: "Wakey, wakey, Hero", src: "/backgrounds/6.mp4" },
    ],
    []
  );

  const imageToVideo = useMemo(
    () => [
      { title: "Image to Video — Atmosphere Push", src: "/backgrounds/6.mp4" },
      {
        title: "Image to Video — Character Motion",
        src: "/backgrounds/14.mp4",
      },
      { title: "Image to Video — Camera Drift", src: "/backgrounds/8.mp4" },
      { title: "Image to Video — Detail Reveal", src: "/backgrounds/17.mp4" },
    ],
    []
  );

  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const TOOL_ROUTES = {
    referenceToVideo: "/create/video?tool=reference-to-video",
    imageToVideo: "/create/video?tool=image-to-video",
    textToVideo: "/create/video?tool=text-to-video",
    referenceToImage: "/create/image?tool=reference-to-image",
    textToImage: "/create/image?tool=text-to-image",
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden text-white">
      <ScrollProgress />
      <WallpaperRevealBackground src="/wallpaper.jpg" radius={240} />

      <header className="fixed inset-x-0 top-0 z-[2000]">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/45 px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8">
                <Image
                  src="/koanimationlogo.png"
                  alt="KOANimation logo"
                  fill
                  priority
                  className="object-contain mix-blend-screen drop-shadow-[0_0_10px_rgba(168,85,247,0.30)]"
                />
              </div>

              <span className="font-semibold tracking-tight text-white/90">
                KOANimation
              </span>
            </div>

            <nav className="hidden items-center gap-7 text-[13px] font-medium tracking-wide text-white/65 md:flex">
              <div className="group relative">
                <a
                  className="inline-flex items-center gap-2 transition hover:text-white"
                  href="#features"
                >
                  Features
                  <span className="translate-y-[1px] text-[12px] leading-none text-white/35">
                    ▾
                  </span>
                </a>

                <div className="absolute left-0 top-full h-4 w-full" />

                <div className="pointer-events-none absolute left-0 top-full z-[3000] mt-2 w-64 translate-y-2 rounded-2xl border border-white/10 bg-black/70 opacity-0 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur transition duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="p-2">
                    <AuthMenuItem
                      href={TOOL_ROUTES.referenceToVideo}
                      label="Reference to Video"
                    />
                    <AuthMenuItem
                      href={TOOL_ROUTES.imageToVideo}
                      label="Image to Video"
                    />
                    <AuthMenuItem
                      href={TOOL_ROUTES.textToVideo}
                      label="Text to Video"
                    />
                    <div className="my-2 h-px bg-white/10" />
                    <AuthMenuItem
                      href={TOOL_ROUTES.referenceToImage}
                      label="Reference to Image"
                    />
                    <AuthMenuItem
                      href={TOOL_ROUTES.textToImage}
                      label="Text to Image"
                    />
                  </div>
                </div>
              </div>

              <a className="transition hover:text-white" href="#showcase">
                Showcase
              </a>

              <Link className="transition hover:text-white" href="/pricing">
                Pricing
              </Link>

              <a className="transition hover:text-white" href="#resources">
                Resources
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <AuthCTAButton
                href="/tools"
                className="shadow-[0_0_35px_rgba(96,165,250,0.18)]"
              >
                Try KOANimation
              </AuthCTAButton>
            </div>
          </div>
        </div>
      </header>

      <section className="relative min-h-screen overflow-hidden">
        <FloatingMediaWall />
        <FloatingOrbs />

        <div className="absolute inset-0 z-[1] bg-black/55" />
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_45%,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.70)_70%,rgba(0,0,0,0.90)_100%)]" />
        <div className="absolute inset-0 z-[3] bg-[radial-gradient(circle_at_25%_25%,rgba(168,85,247,0.16),transparent_60%),radial-gradient(circle_at_75%_40%,rgba(59,130,246,0.10),transparent_65%)]" />

        <div className="absolute inset-0 z-[4]">
          <Particles
            id="tsparticles"
            init={particlesInit}
            options={{
              fullScreen: false,
              background: { color: "transparent" },
              fpsLimit: 60,
              particles: {
                number: { value: 22, density: { enable: true, area: 1100 } },
                color: { value: ["#a855f7", "#60a5fa", "#22d3ee"] },
                opacity: { value: 0.08 },
                size: { value: { min: 1, max: 2.2 } },
                move: {
                  enable: true,
                  speed: 0.2,
                  direction: "none",
                  outModes: { default: "out" },
                },
                links: {
                  enable: true,
                  distance: 160,
                  opacity: 0.04,
                  color: "#a855f7",
                },
              },
              detectRetina: true,
            }}
            className="h-full w-full"
          />
        </div>

        <div className="relative z-[1000] mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 pt-28">
          <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs text-white/70 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-violet-400/80 shadow-[0_0_12px_rgba(168,85,247,0.7)]" />
                Cinematic anime motion studio
              </div>

              <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)] sm:text-6xl md:text-7xl">
                Old Soul.
                <span className="block">New Motion.</span>
                <span className="block bg-[linear-gradient(to_right,#ffffff,#c4b5fd,#7dd3fc)] bg-clip-text text-transparent">
                  KOANimation.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/68 md:text-lg">
                Create stylized anime motion with reference-aware workflows,
                cinematic camera movement, and studio-grade presentation built
                for creators who care about aesthetic control.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <AuthCTAButton
                  href="/tools"
                  className="border-0 bg-white text-black hover:bg-white/90"
                >
                  Launch Studio
                </AuthCTAButton>

                <AuthCTAButton
                  href={TOOL_ROUTES.referenceToVideo}
                  className="bg-white/8"
                >
                  Explore Workflows
                </AuthCTAButton>
              </div>

              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  "Reference-consistent motion",
                  "Image-to-video atmosphere",
                  "Cinematic anime presentation",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/72 backdrop-blur"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 rounded-[40px] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.18),transparent_55%)] blur-3xl" />
              <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-black/35 p-4 shadow-[0_40px_140px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      KOANimation Studio
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      Reference-driven anime motion workflows
                    </div>
                  </div>
                  <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                    Live
                  </div>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-white/10">
                  <video
                    className="h-[240px] w-full object-cover sm:h-[320px]"
                    src="/backgrounds/15.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                      Workflow
                    </div>
                    <div className="mt-2 text-sm font-medium text-white/85">
                      Reference to Video
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                      Output
                    </div>
                    <div className="mt-2 text-sm font-medium text-white/85">
                      Stylized cinematic clips
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[10] h-28 bg-gradient-to-b from-transparent to-black/80" />
      </section>

      <section className="relative -mt-6 pb-10">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Aesthetic Control",
                desc: "Design motion with a more intentional visual identity, not random generations.",
              },
              {
                title: "Studio Workflows",
                desc: "Jump into focused tools for reference-to-video, image-to-video, and text generation.",
              },
              {
                title: "Creator Presentation",
                desc: "Premium outputs and a polished interface that feels closer to a real studio.",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className={[
                  "rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur",
                  i === 0
                    ? "shadow-[0_0_50px_rgba(168,85,247,0.08)]"
                    : i === 1
                      ? "shadow-[0_0_50px_rgba(59,130,246,0.07)]"
                      : "shadow-[0_0_50px_rgba(255,255,255,0.04)]",
                ].join(" ")}
              >
                <div className="text-base font-semibold text-white">
                  {item.title}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative pb-10 pt-8">
        <div className="mx-auto w-full max-w-7xl px-6">
          <MarqueeRow
            items={[
              "Reference to Video",
              "Image to Video",
              "Text to Video",
              "Reference to Image",
              "Text to Image",
              "Anime Motion",
              "Character Consistency",
              "Cinematic Camera",
              "Atmospheric Rendering",
              "Creator-first Studio",
            ]}
          />
        </div>
      </section>

      <section className="relative pb-20 pt-12">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                <span className="h-2 w-2 rounded-full bg-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
                Core modes
              </div>
              <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Choose your workflow
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
                Start from references, stills, or text prompts depending on how
                much control you want over the final motion.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <ToolModeCard
              title="Reference to Video"
              desc="Match a subject or style and animate with stronger consistency."
              href={TOOL_ROUTES.referenceToVideo}
              accentClass="shadow-[0_0_50px_rgba(168,85,247,0.08)]"
            />
            <ToolModeCard
              title="Image to Video"
              desc="Bring still artwork to life with motion, camera, and atmosphere."
              href={TOOL_ROUTES.imageToVideo}
              accentClass="shadow-[0_0_50px_rgba(59,130,246,0.08)]"
            />
            <ToolModeCard
              title="Text to Video"
              desc="Generate clips from prompt-first cinematic direction."
              href={TOOL_ROUTES.textToVideo}
              accentClass="shadow-[0_0_50px_rgba(236,72,153,0.07)]"
            />
            <ToolModeCard
              title="Reference to Image"
              desc="Create style-aware images with more controlled visual identity."
              href={TOOL_ROUTES.referenceToImage}
              accentClass="shadow-[0_0_50px_rgba(234,179,8,0.07)]"
            />
            <ToolModeCard
              title="Text to Image"
              desc="Generate polished stills ready for concepting or animation input."
              href={TOOL_ROUTES.textToImage}
              accentClass="shadow-[0_0_50px_rgba(255,255,255,0.04)]"
            />
          </div>
        </div>
      </section>

      <section className="relative pb-12">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-blue-400/80 shadow-[0_0_12px_rgba(96,165,250,0.7)]" />
              Why it feels premium
            </div>
            <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Built like a real studio
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              value="5"
              label="Creative modes on one platform"
              glow="shadow-[0_0_60px_rgba(168,85,247,0.08)]"
            />
            <MetricCard
              value="∞"
              label="Stylized directions you can explore"
              glow="shadow-[0_0_60px_rgba(59,130,246,0.08)]"
            />
            <MetricCard
              value="24/7"
              label="Always-available creation workflow"
              glow="shadow-[0_0_60px_rgba(34,211,238,0.08)]"
            />
          </div>
        </div>
      </section>

      <section id="showcase" className="relative pb-20 pt-10">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Reference to Video
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
                Create videos that align with reference subjects, such as
                characters, objects, and scenes.
              </p>
            </div>

            <div className="mt-2 flex items-center gap-3 md:mt-0">
              <AuthCTAButton href={TOOL_ROUTES.referenceToVideo}>
                Open Studio
              </AuthCTAButton>
            </div>
          </div>

          <div className="mt-10">
            <VideoCarousel items={showcase} initialIndex={0} />
          </div>
        </div>
      </section>

      <section id="features" className="relative py-16">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-violet-400/80 shadow-[0_0_12px_rgba(168,85,247,0.7)]" />
              Highlights
            </div>
            <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Built for stylish motion creation
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FeatureCard
              title="First & Last Frames Control"
              desc="Upload the first and last frame images, and KOANimation creates smooth transitions in between."
              mediaSrc="/backgrounds/16.mp4"
              ctaHref="/tools"
              ctaLabel="Get Started"
              glowClass="shadow-[0_0_80px_rgba(168,85,247,0.08)]"
              badge="Frame Control"
            />
            <FeatureCard
              title="Anime Art to Video"
              desc="Transform anime art into fluid animations with lifelike character motion and cinematic camera."
              mediaSrc="/backgrounds/7.mp4"
              ctaHref="/tools"
              ctaLabel="Get Started"
              glowClass="shadow-[0_0_80px_rgba(59,130,246,0.08)]"
              badge="Animation"
            />
          </div>
        </div>
      </section>

      <section className="relative py-10">
        <div className="mx-auto w-full max-w-7xl px-6">
          <HoverSpotlightSection>
            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl md:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0.01)_20%,rgba(0,0,0,0.08)_100%)]" />
              <div className="relative z-10">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                  <span className="h-2 w-2 rounded-full bg-fuchsia-400/80 shadow-[0_0_12px_rgba(217,70,239,0.7)]" />
                  Visual playground
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <BentoCard
                    title="Noir Mood"
                    desc="Dark cinematic frames with contrast, rain, glow, and pressure."
                    mediaSrc="/backgrounds/12.mp4"
                    badge="Atmosphere"
                    glowClass="shadow-[0_0_70px_rgba(168,85,247,0.08)]"
                    tall
                  />
                  <BentoCard
                    title="Painterly Motion"
                    desc="Bring static illustrations into elegant motion without losing style."
                    mediaSrc="/backgrounds/14.mp4"
                    badge="Motion"
                    glowClass="shadow-[0_0_70px_rgba(59,130,246,0.08)]"
                  />
                  <BentoCard
                    title="Scene Reveal"
                    desc="Use subtle camera drift and staged composition for drama."
                    mediaSrc="/backgrounds/17.mp4"
                    badge="Camera"
                    glowClass="shadow-[0_0_70px_rgba(34,211,238,0.08)]"
                  />
                  <BentoCard
                    title="Character Presence"
                    desc="Maintain stronger subject identity while pushing cinematic framing."
                    mediaSrc="/backgrounds/6.mp4"
                    badge="Character"
                    glowClass="shadow-[0_0_70px_rgba(236,72,153,0.08)]"
                  />
                  <BentoCard
                    title="Fantasy Energy"
                    desc="Use color, movement, and spatial depth for high-impact scenes."
                    mediaSrc="/backgrounds/2.mp4"
                    badge="Style"
                    glowClass="shadow-[0_0_70px_rgba(250,204,21,0.08)]"
                  />
                </div>
              </div>
            </div>
          </HoverSpotlightSection>
        </div>
      </section>

      <section id="templates" className="relative pb-20 pt-10">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:gap-6">
              <h2 className="text-[42px] font-semibold tracking-[-0.02em] text-white md:text-5xl">
                Image to Video
              </h2>

              <span className="text-2xl leading-none text-white/20 md:hidden">
                |
              </span>
              <div className="hidden h-10 w-px bg-white/10 md:block" />

              <p className="max-w-2xl text-[13px] leading-[1.7] text-white/65 md:text-sm md:leading-relaxed">
                Bring still images to life with dynamic motion that aligns with
                your vision.
              </p>
            </div>

            <div className="mt-1 flex items-center gap-3 md:mt-0">
              <AuthCTAButton href={TOOL_ROUTES.imageToVideo}>
                Open Studio
              </AuthCTAButton>
            </div>
          </div>

          <div className="mt-10">
            <ImageToVideoCarousel items={imageToVideo} initialIndex={0} />
          </div>
        </div>
      </section>

      <section className="relative py-14">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
              Workflow
            </div>
            <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              From idea to final motion
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
              A simple creative loop that still feels powerful enough for a real
              studio pipeline.
            </p>
          </div>

          <StudioTimeline
            items={[
              {
                step: "01",
                title: "Choose a mode",
                desc: "Start from reference, image, or text depending on how much direction you already have.",
                glow: "shadow-[0_0_60px_rgba(168,85,247,0.08)]",
              },
              {
                step: "02",
                title: "Shape the look",
                desc: "Define mood, framing, motion type, and aesthetic intent for stronger results.",
                glow: "shadow-[0_0_60px_rgba(59,130,246,0.08)]",
              },
              {
                step: "03",
                title: "Generate iterations",
                desc: "Explore multiple passes until the pacing, energy, and atmosphere feel right.",
                glow: "shadow-[0_0_60px_rgba(236,72,153,0.08)]",
              },
              {
                step: "04",
                title: "Present your clip",
                desc: "Export work that feels polished, cinematic, and ready to show on your platform.",
                glow: "shadow-[0_0_60px_rgba(34,211,238,0.08)]",
              },
            ]}
          />
        </div>
      </section>

      <section id="resources" className="relative py-16">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-start">
            <div>
              <h2 className="text-5xl font-semibold leading-[0.95] tracking-tight text-white">
                Frequently
                <br />
                Asked
                <br />
                Questions
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
                Find answers about features, usage, workflow, and how to get the
                best results.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: "What is KOANimation?",
                  a: "KOANimation is a creator-focused studio for generating anime-style motion clips from references and prompts.",
                },
                {
                  q: "What’s the use of KOANimation?",
                  a: "Use it to prototype scenes, iterate on style-consistent motion, and build a repeatable pipeline for your clips.",
                },
                {
                  q: "What’s the difference between Reference-to-Video and Image-to-Video?",
                  a: "Reference-to-Video emphasizes matching a subject/style across generations. Image-to-Video focuses on animating a specific still image into motion.",
                },
              ].map((item, i) => (
                <FAQItem
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  open={faqOpen === i}
                  onToggle={() => setFaqOpen((cur) => (cur === i ? null : i))}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative pb-24 pt-8">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_40px_140px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_left,rgba(168,85,247,0.15),transparent_30%)]" />
            <video
              className="h-[300px] w-full object-cover md:h-[360px]"
              src="/backgrounds/15.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 bg-black/60" />
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <div>
                <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs text-white/70 backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
                  Start creating
                </div>
                <h3 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  Embrace Your Creativity
                </h3>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/68 md:text-base">
                  Step into a more cinematic creation flow and build motion that
                  feels intentional, atmospheric, and uniquely yours.
                </p>
                <AuthCTAButton
                  href={TOOL_ROUTES.referenceToVideo}
                  className="mt-6 border-0 bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.30)] hover:bg-blue-500"
                >
                  Try it now
                </AuthCTAButton>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <GlowDivider />
          </div>

          <div className="mt-10 flex items-center justify-between text-sm text-white/50">
            <span>© {new Date().getFullYear()} KOANimation</span>
            <div className="flex gap-4">
              <a className="hover:text-white/80" href="#features">
                Features
              </a>
              <a className="hover:text-white/80" href="#resources">
                FAQ
              </a>
              <Link className="hover:text-white/80" href="/pricing">
                Pricing
              </Link>
              <Link className="hover:text-white/80" href="/roadmap">
                Roadmap
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}