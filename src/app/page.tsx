"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Particles from "react-tsparticles";
import type { Engine } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";
import FloatingMediaWall from "./components/FloatingMediaWall";
import { getCurrentUser } from "@/app/lib/supabase/session";

import { motion, useReducedMotion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import Lenis from "lenis";
import Tilt from "react-parallax-tilt";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  ImageIcon,
  Layers3,
  Sparkles,
  Wand2,
  Zap,
  Play,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import gsap from "gsap";
import useEmblaCarousel from "embla-carousel-react";
import Marquee from "react-fast-marquee";
import Balancer from "react-wrap-balancer";
import useMeasure from "react-use-measure";

function cn(...inputs: Array<string | undefined | false | null>) {
  return twMerge(clsx(inputs));
}

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

function SectionEyebrow({
  label,
  icon,
  dotClass = "bg-violet-400/80 shadow-[0_0_12px_rgba(168,85,247,0.7)]",
}: {
  label: string;
  icon?: ReactNode;
  dotClass?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur">
      {icon ? icon : <span className={cn("h-2 w-2 rounded-full", dotClass)} />}
      {label}
    </div>
  );
}

function useLenisScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      touchMultiplier: 1.2,
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
  }, []);
}

function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [ref, inView] = useInView({
    triggerOnce: once,
    threshold: 0.12,
  });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={prefersReducedMotion ? false : { opacity: 0, y }}
      animate={
        prefersReducedMotion
          ? { opacity: 1, y: 0 }
          : inView
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y }
      }
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function AuthMenuItem({ href, label }: { href: string; label: string }) {
  const go = useAuthNavigate();

  return (
    <button
      type="button"
      onClick={() => go(href)}
      className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-[13px] text-white/75 transition duration-300 hover:bg-white/5 hover:text-white"
    >
      <span>{label}</span>
      <ArrowRight className="h-4 w-4 text-white/30" />
    </button>
  );
}

function AuthCTAButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const go = useAuthNavigate();

  return (
    <motion.button
      type="button"
      whileHover={{ y: -2, scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => go(href)}
      className={cn(
        "cursor-pointer rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition duration-300 hover:bg-white/20 hover:shadow-[0_10px_40px_rgba(255,255,255,0.10)]",
        className
      )}
    >
      {children}
    </motion.button>
  );
}

function GlassCard({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-xl",
        "shadow-[0_24px_90px_rgba(0,0,0,0.36)]",
        hover &&
          "transition duration-500 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.055),rgba(255,255,255,0.012)_22%,rgba(0,0,0,0.08)_100%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[23px] border border-white/[0.06]" />
      <div className="pointer-events-none absolute -left-[140%] top-0 h-full w-[80%] rotate-12 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.12),transparent)] opacity-0 blur-xl transition duration-700 group-hover:left-[140%] group-hover:opacity-100" />
      {children}
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
        rgba(0,0,0,0) 45%,
        rgba(0,0,0,0.90) 72%,
        rgba(0,0,0,0.96) 100%)`
    : `rgba(0,0,0,0.92)`;

  return (
    <>
      <div className="fixed inset-0 -z-40">
        <img
          src={src}
          alt="Wallpaper"
          className="h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-30">
        <div className="absolute inset-0" style={{ background: spotlight }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.04)_0%,rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.92)_100%)]" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-20 opacity-80">
        <div className="absolute -left-24 top-10 h-[420px] w-[420px] rounded-full bg-violet-600/15 blur-[150px]" />
        <div className="absolute right-[-70px] top-[18%] h-[360px] w-[360px] rounded-full bg-blue-500/12 blur-[150px]" />
        <div className="absolute bottom-[-90px] left-[18%] h-[280px] w-[280px] rounded-full bg-fuchsia-500/10 blur-[130px]" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-[10%] top-[14%] h-[28rem] w-[28rem] animate-[floatGlow_18s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.14),transparent_60%)] blur-3xl" />
        <div className="absolute right-[4%] top-[36%] h-[24rem] w-[24rem] animate-[floatGlow_22s_ease-in-out_infinite_reverse] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12),transparent_60%)] blur-3xl" />
        <div className="absolute left-[35%] bottom-[8%] h-[20rem] w-[20rem] animate-[floatGlow_20s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.08),transparent_60%)] blur-3xl" />
      </div>

      <style jsx global>{`
        @keyframes floatGlow {
          0%,
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(20px, -18px, 0) scale(1.05);
          }
        }
      `}</style>
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

function EmblaVideoCarousel({
  items,
  title,
  large = false,
}: {
  items: { title: string; src: string }[];
  title: string;
  large?: boolean;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();
  const active = items[selectedIndex] ?? items[0];

  return (
    <div className="relative">
      <div className="relative mx-auto w-full max-w-6xl">
        <GlassCard className="overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.15),transparent_30%)]" />

          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {items.map((item) => (
                <div key={item.src} className="min-w-0 flex-[0_0_100%]">
                  <video
                    className={cn(
                      "w-full object-cover transition duration-700 group-hover:scale-[1.02]",
                      large
                        ? "h-[340px] sm:h-[440px] md:h-[520px]"
                        : "h-[260px] sm:h-[360px] md:h-[460px]"
                    )}
                    src={item.src}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.52)_62%,rgba(0,0,0,0.88)_100%)]" />

          <div className="pointer-events-none absolute left-5 top-5 z-20 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
            {title}
          </div>

          <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 w-[min(92%,620px)] -translate-x-1/2">
            <div className="pointer-events-auto flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-3 py-3 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur">
              {items.map((item, index) => {
                const isActive = index === selectedIndex;
                return (
                  <button
                    key={item.src}
                    onClick={() => emblaApi?.scrollTo(index)}
                    aria-label={`Select ${item.title}`}
                    className={cn(
                      "relative overflow-hidden rounded-xl border transition duration-300 focus:outline-none focus:ring-2 focus:ring-white/20",
                      isActive
                        ? "border-white/25 ring-1 ring-white/15 shadow-[0_0_20px_rgba(255,255,255,0.08)]"
                        : "border-white/10 hover:border-white/20"
                    )}
                  >
                    <video
                      className="h-14 w-24 object-cover sm:h-16 sm:w-28"
                      src={item.src}
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
        </GlassCard>

        <button
          aria-label="Previous"
          onClick={scrollPrev}
          className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-3 text-white/90 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur transition duration-300 hover:scale-105 hover:bg-black/60 md:-left-10 md:p-4"
        >
          <ChevronLeft className="h-6 w-6 md:h-7 md:w-7" />
        </button>

        <button
          aria-label="Next"
          onClick={scrollNext}
          className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-3 text-white/90 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur transition duration-300 hover:scale-105 hover:bg-black/60 md:-right-10 md:p-4"
        >
          <ChevronRight className="h-6 w-6 md:h-7 md:w-7" />
        </button>

        <div className="mt-5 text-center text-white/65">
          <span className="text-sm">{active?.title}</span>
        </div>
      </div>
    </div>
  );
}

function ToolModeCard({
  title,
  desc,
  href,
  accentClass,
  icon,
}: {
  title: string;
  desc: string;
  href: string;
  accentClass: string;
  icon: ReactNode;
}) {
  const go = useAuthNavigate();

  return (
    <Tilt
      tiltMaxAngleX={4}
      tiltMaxAngleY={4}
      glareEnable
      glareMaxOpacity={0.06}
      scale={1.01}
      transitionSpeed={1800}
      className="rounded-3xl"
    >
      <button
        type="button"
        onClick={() => go(href)}
        className={cn(
          "group relative w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur transition duration-500",
          "hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]",
          accentClass
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0.01)_20%,rgba(0,0,0,0.08)_100%)]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[23px] border border-white/[0.06]" />
        <div className="pointer-events-none absolute -right-8 top-0 h-20 w-20 rounded-full bg-white/10 blur-2xl opacity-20 transition duration-500 group-hover:opacity-40" />
        <div className="pointer-events-none absolute -left-[140%] top-0 h-full w-[80%] rotate-12 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.12),transparent)] opacity-0 blur-xl transition duration-700 group-hover:left-[140%] group-hover:opacity-100" />
        <div className="relative z-10">
          <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/25 p-2 text-white/75">
            {icon}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="text-base font-semibold text-white">{title}</div>
            <div className="text-white/30 transition duration-300 group-hover:translate-x-1 group-hover:text-white/80">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/65">{desc}</p>
        </div>
      </button>
    </Tilt>
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
    <GlassCard className={cn("p-6", glow)}>
      <div className="relative z-10">
        <div className="text-3xl font-semibold tracking-tight text-white transition duration-300 group-hover:text-white md:text-4xl">
          {value}
        </div>
        <div className="mt-2 text-sm text-white/60">{label}</div>
      </div>
    </GlassCard>
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
    <GlassCard className={cn("p-8", glowClass)}>
      <div className="pointer-events-none absolute -top-10 left-8 h-28 w-28 rounded-full bg-white/10 blur-3xl opacity-40 transition duration-500 group-hover:opacity-70" />
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
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-5 py-2.5 text-sm font-semibold text-white/85 backdrop-blur transition duration-300 hover:-translate-y-[1px] hover:bg-white/15 hover:text-white"
          >
            {ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="relative hidden w-[260px] shrink-0 md:block">
          <div className="absolute -inset-10 rounded-[40px] bg-white/10 blur-3xl opacity-25" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <video
              className="h-[160px] w-full object-cover transition duration-700 group-hover:scale-105"
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
    </GlassCard>
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
    <GlassCard className={cn("p-5", glowClass, tall && "md:row-span-2")}>
      <div className="relative z-10 flex h-full flex-col">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
          <span className="h-2 w-2 rounded-full bg-white/25" />
          {badge}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <video
            className={
              tall
                ? "h-[300px] w-full object-cover transition duration-700 group-hover:scale-105 md:h-[420px]"
                : "h-[220px] w-full object-cover transition duration-700 group-hover:scale-105"
            }
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
    </GlassCard>
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
  const [measureRef, bounds] = useMeasure();

  return (
    <button
      onClick={onToggle}
      className="group w-full cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-left transition duration-300 hover:border-white/20 hover:bg-white/[0.07] backdrop-blur"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-white/90 sm:text-base">
          {q}
        </span>
        <span className="text-xl leading-none text-white/60 transition duration-300 group-hover:text-white/90">
          {open ? "–" : "+"}
        </span>
      </div>

      <div
        className="overflow-hidden transition-[height,opacity,margin] duration-300"
        style={{
          height: open ? bounds.height : 0,
          opacity: open ? 1 : 0,
          marginTop: open ? 12 : 0,
        }}
      >
        <div ref={measureRef} className="text-sm leading-relaxed text-white/70">
          {a}
        </div>
      </div>
    </button>
  );
}

function MarqueeRow({ items }: { items: string[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25 py-3 backdrop-blur">
      <Marquee speed={34} gradient={false} pauseOnHover>
        {items.concat(items).map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="mx-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            {item}
          </span>
        ))}
      </Marquee>
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
      {items.map((item, i) => (
        <Reveal key={item.step} delay={i * 0.06}>
          <GlassCard className={cn("p-5", item.glow)}>
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
          </GlassCard>
        </Reveal>
      ))}
    </div>
  );
}

function HoverSpotlightSection({
  children,
}: {
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStyle({
      background: `radial-gradient(circle 260px at ${x}px ${y}px, rgba(168,85,247,0.11), rgba(59,130,246,0.07) 35%, transparent 72%)`,
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className="relative overflow-hidden rounded-[36px]"
    >
      <div
        className="pointer-events-none absolute inset-0 transition duration-150"
        style={style}
      />
      {children}
    </div>
  );
}

function QuoteCard({
  quote,
  name,
  role,
  glow,
}: {
  quote: string;
  name: string;
  role: string;
  glow: string;
}) {
  return (
    <GlassCard className={cn("p-6", glow)}>
      <div className="relative z-10">
        <div className="text-4xl leading-none text-white/20">“</div>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{quote}</p>
        <div className="mt-5">
          <div className="text-sm font-semibold text-white">{name}</div>
          <div className="text-xs text-white/50">{role}</div>
        </div>
      </div>
    </GlassCard>
  );
}

function BenefitRow({
  title,
  desc,
  accent,
}: {
  title: string;
  desc: string;
  accent: string;
}) {
  return (
    <div className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:border-white/20 hover:bg-white/[0.07]">
      <div className={cn("mb-4 h-2 w-16 rounded-full", accent)} />
      <div className="text-lg font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-white/65">{desc}</p>
    </div>
  );
}

export default function Home() {
  useLenisScroll();

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  const heroRef = useRef<HTMLDivElement | null>(null);
  const heroBadgeRef = useRef<HTMLDivElement | null>(null);
  const heroTitleRef = useRef<HTMLHeadingElement | null>(null);
  const heroTextRef = useRef<HTMLParagraphElement | null>(null);
  const heroButtonsRef = useRef<HTMLDivElement | null>(null);
  const heroChipsRef = useRef<HTMLDivElement | null>(null);
  const heroPreviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set(
        [
          heroBadgeRef.current,
          heroTitleRef.current,
          heroTextRef.current,
          heroButtonsRef.current,
          heroChipsRef.current,
          heroPreviewRef.current,
        ],
        {
          opacity: 0,
          y: 28,
        }
      );

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(heroBadgeRef.current, { opacity: 1, y: 0, duration: 0.55 })
        .to(heroTitleRef.current, { opacity: 1, y: 0, duration: 0.75 }, "-=0.2")
        .to(heroTextRef.current, { opacity: 1, y: 0, duration: 0.6 }, "-=0.4")
        .to(heroButtonsRef.current, { opacity: 1, y: 0, duration: 0.55 }, "-=0.35")
        .to(heroChipsRef.current, { opacity: 1, y: 0, duration: 0.55 }, "-=0.3")
        .to(heroPreviewRef.current, { opacity: 1, y: 0, duration: 0.8 }, "-=0.55");
    }, heroRef);

    return () => ctx.revert();
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
          <motion.div
            initial={{ y: -18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/45 px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.55)] backdrop-blur transition duration-300 hover:border-white/15"
          >
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
                  className="inline-flex items-center gap-2 rounded-full px-2 py-1 transition duration-300 hover:bg-white/5 hover:text-white"
                  href="#features"
                >
                  Features
                  <ChevronDown className="h-3.5 w-3.5 text-white/35" />
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

              <a
                className="rounded-full px-2 py-1 transition duration-300 hover:bg-white/5 hover:text-white"
                href="#showcase"
              >
                Showcase
              </a>

              <Link
                className="rounded-full px-2 py-1 transition duration-300 hover:bg-white/5 hover:text-white"
                href="/pricing"
              >
                Pricing
              </Link>

              <a
                className="rounded-full px-2 py-1 transition duration-300 hover:bg-white/5 hover:text-white"
                href="#resources"
              >
                Resources
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <AuthCTAButton
                href="/tools"
                className="shadow-[0_0_35px_rgba(96,165,250,0.18)] hover:shadow-[0_0_50px_rgba(96,165,250,0.28)]"
              >
                Try KOANimation
              </AuthCTAButton>
            </div>
          </motion.div>
        </div>
      </header>

      <section ref={heroRef} className="relative min-h-screen overflow-hidden">
        <FloatingMediaWall />
        <FloatingOrbs />

        <div className="absolute inset-0 z-[1] bg-black/55" />
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_45%,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.70)_70%,rgba(0,0,0,0.92)_100%)]" />
        <div className="absolute inset-0 z-[3] bg-[radial-gradient(circle_at_25%_25%,rgba(168,85,247,0.15),transparent_58%),radial-gradient(circle_at_75%_40%,rgba(59,130,246,0.10),transparent_65%)]" />
        <div className="absolute inset-0 z-[4] bg-[linear-gradient(to_right,rgba(0,0,0,0.70)_0%,rgba(0,0,0,0.48)_30%,rgba(0,0,0,0.32)_52%,rgba(0,0,0,0.44)_100%)]" />
        <div className="absolute left-0 top-0 z-[5] h-full w-[52%] bg-[radial-gradient(circle_at_25%_35%,rgba(0,0,0,0.08),rgba(0,0,0,0.58)_55%,rgba(0,0,0,0.85)_100%)]" />

        <div className="absolute inset-0 z-[6]">
          <Particles
            id="tsparticles"
            init={particlesInit}
            options={{
              fullScreen: false,
              background: { color: "transparent" },
              fpsLimit: 60,
              particles: {
                number: { value: 20, density: { enable: true, area: 1100 } },
                color: { value: ["#a855f7", "#60a5fa", "#22d3ee"] },
                opacity: { value: 0.07 },
                size: { value: { min: 1, max: 2 } },
                move: {
                  enable: true,
                  speed: 0.18,
                  direction: "none",
                  outModes: { default: "out" },
                },
                links: {
                  enable: true,
                  distance: 150,
                  opacity: 0.035,
                  color: "#a855f7",
                },
              },
              detectRetina: true,
            }}
            className="h-full w-full"
          />
        </div>

        <div className="relative z-[1000] mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 pt-28">
          <div className="grid w-full gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div className="max-w-3xl">
              <div ref={heroBadgeRef}>
                <SectionEyebrow
                  label="Luxury anime motion studio"
                  icon={<Sparkles className="h-3.5 w-3.5 text-violet-300" />}
                />
              </div>

              <h1
                ref={heroTitleRef}
                className="mt-6 text-5xl font-semibold tracking-[-0.05em] text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)] sm:text-6xl md:text-7xl"
              >
                <Balancer>
                  Old Soul.
                  <span className="block">New Motion.</span>
                  <span className="block bg-[linear-gradient(to_right,#ffffff,#ddd6fe,#7dd3fc)] bg-clip-text text-transparent">
                    KOANimation.
                  </span>
                </Balancer>
              </h1>

              <p
                ref={heroTextRef}
                className="mt-7 max-w-2xl text-base leading-relaxed text-white/68 md:text-lg"
              >
                Create stylized anime motion with reference-aware workflows,
                cinematic camera movement, and a premium studio interface built
                for creators who care about atmosphere, identity, and control.
              </p>

              <div
                ref={heroButtonsRef}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <AuthCTAButton
                  href="/tools"
                  className="border-0 bg-white text-black hover:bg-white/90"
                >
                  Launch Studio
                </AuthCTAButton>

                <AuthCTAButton
                  href={TOOL_ROUTES.referenceToVideo}
                  className="bg-white/8 hover:bg-white/18"
                >
                  Explore Workflows
                </AuthCTAButton>
              </div>

              <div
                ref={heroChipsRef}
                className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3"
              >
                {[
                  {
                    text: "Reference-consistent motion",
                    hover:
                      "hover:bg-violet-500/[0.12] hover:shadow-[0_0_30px_rgba(168,85,247,0.12)]",
                  },
                  {
                    text: "Image-to-video atmosphere",
                    hover:
                      "hover:bg-cyan-500/[0.10] hover:shadow-[0_0_30px_rgba(34,211,238,0.12)]",
                  },
                  {
                    text: "Cinematic anime presentation",
                    hover:
                      "hover:bg-blue-500/[0.10] hover:shadow-[0_0_30px_rgba(59,130,246,0.12)]",
                  },
                ].map((item) => (
                  <div
                    key={item.text}
                    className={cn(
                      "rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/72 backdrop-blur transition duration-300",
                      "hover:-translate-y-1 hover:border-white/20 hover:text-white",
                      item.hover
                    )}
                  >
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            <div ref={heroPreviewRef} className="relative">
              <div className="absolute -inset-8 rounded-[40px] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.16),transparent_55%)] blur-3xl" />
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Tilt
                  tiltMaxAngleX={3}
                  tiltMaxAngleY={3}
                  glareEnable
                  glareMaxOpacity={0.08}
                  scale={1.01}
                  transitionSpeed={2200}
                  className="rounded-[30px]"
                >
                  <GlassCard className="overflow-hidden p-4 shadow-[0_42px_160px_rgba(0,0,0,0.58)]">
                    <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition duration-300 group-hover:bg-white/[0.06]">
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
                        className="h-[240px] w-full object-cover transition duration-700 group-hover:scale-105 sm:h-[320px]"
                        src="/backgrounds/15.mp4"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                      />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:bg-violet-500/[0.10] hover:shadow-[0_0_30px_rgba(168,85,247,0.12)]">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                          Workflow
                        </div>
                        <div className="mt-2 text-sm font-medium text-white/85">
                          Reference to Video
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition duration-300 hover:bg-cyan-500/[0.10] hover:shadow-[0_0_30px_rgba(34,211,238,0.12)]">
                        <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                          Output
                        </div>
                        <div className="mt-2 text-sm font-medium text-white/85">
                          Stylized cinematic clips
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </Tilt>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[10] h-28 bg-gradient-to-b from-transparent to-black/80" />
      </section>

      <section className="relative -mt-4 pb-10">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Aesthetic Control",
                desc: "Design motion with a more intentional visual identity, not random generations.",
                hover:
                  "hover:bg-violet-500/[0.10] hover:shadow-[0_0_45px_rgba(168,85,247,0.12)]",
              },
              {
                title: "Studio Workflows",
                desc: "Jump into focused tools for reference-to-video, image-to-video, and text generation.",
                hover:
                  "hover:bg-blue-500/[0.10] hover:shadow-[0_0_45px_rgba(59,130,246,0.12)]",
              },
              {
                title: "Creator Presentation",
                desc: "Premium outputs and a polished interface that feels closer to a real studio.",
                hover:
                  "hover:bg-cyan-500/[0.10] hover:shadow-[0_0_45px_rgba(34,211,238,0.12)]",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06}>
                <GlassCard className={cn("p-5", item.hover)}>
                  <div className="relative z-10">
                    <div className="text-base font-semibold text-white">
                      {item.title}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">
                      {item.desc}
                    </p>
                  </div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Reveal className="relative pb-10 pt-8">
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
      </Reveal>

      <section className="relative pb-20 pt-12">
        <div className="mx-auto w-full max-w-7xl px-6">
          <Reveal className="mb-8">
            <SectionEyebrow
              label="Core modes"
              icon={<Layers3 className="h-3.5 w-3.5 text-cyan-300" />}
            />
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
              <Balancer>Choose your workflow</Balancer>
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
              Start from references, stills, or text prompts depending on how
              much control you want over the final motion.
            </p>
          </Reveal>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Reveal delay={0.02}>
              <ToolModeCard
                title="Reference to Video"
                desc="Match a subject or style and animate with stronger consistency."
                href={TOOL_ROUTES.referenceToVideo}
                accentClass="shadow-[0_0_50px_rgba(168,85,247,0.08)] hover:bg-violet-500/[0.12] hover:shadow-[0_0_50px_rgba(168,85,247,0.16)]"
                icon={<Film className="h-5 w-5" />}
              />
            </Reveal>
            <Reveal delay={0.08}>
              <ToolModeCard
                title="Image to Video"
                desc="Bring still artwork to life with motion, camera, and atmosphere."
                href={TOOL_ROUTES.imageToVideo}
                accentClass="shadow-[0_0_50px_rgba(59,130,246,0.08)] hover:bg-blue-500/[0.12] hover:shadow-[0_0_50px_rgba(59,130,246,0.16)]"
                icon={<Clapperboard className="h-5 w-5" />}
              />
            </Reveal>
            <Reveal delay={0.14}>
              <ToolModeCard
                title="Text to Video"
                desc="Generate clips from prompt-first cinematic direction."
                href={TOOL_ROUTES.textToVideo}
                accentClass="shadow-[0_0_50px_rgba(236,72,153,0.07)] hover:bg-fuchsia-500/[0.12] hover:shadow-[0_0_50px_rgba(236,72,153,0.15)]"
                icon={<Wand2 className="h-5 w-5" />}
              />
            </Reveal>
            <Reveal delay={0.2}>
              <ToolModeCard
                title="Reference to Image"
                desc="Create style-aware images with more controlled visual identity."
                href={TOOL_ROUTES.referenceToImage}
                accentClass="shadow-[0_0_50px_rgba(234,179,8,0.07)] hover:bg-amber-400/[0.12] hover:shadow-[0_0_50px_rgba(234,179,8,0.16)]"
                icon={<ImageIcon className="h-5 w-5" />}
              />
            </Reveal>
            <Reveal delay={0.26}>
              <ToolModeCard
                title="Text to Image"
                desc="Generate polished stills ready for concepting or animation input."
                href={TOOL_ROUTES.textToImage}
                accentClass="shadow-[0_0_50px_rgba(255,255,255,0.04)] hover:bg-white/[0.10] hover:shadow-[0_0_50px_rgba(255,255,255,0.10)]"
                icon={<Sparkles className="h-5 w-5" />}
              />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="relative pb-12">
        <div className="mx-auto w-full max-w-7xl px-6">
          <Reveal className="mb-8">
            <SectionEyebrow
              label="Why it feels premium"
              icon={<Zap className="h-3.5 w-3.5 text-blue-300" />}
            />
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
              <Balancer>Built like a real studio</Balancer>
            </h2>
          </Reveal>

          <div className="grid gap-4 md:grid-cols-3">
            <Reveal delay={0.02}>
              <MetricCard
                value="5"
                label="Creative modes on one platform"
                glow="shadow-[0_0_60px_rgba(168,85,247,0.08)] hover:shadow-[0_0_60px_rgba(168,85,247,0.16)]"
              />
            </Reveal>
            <Reveal delay={0.08}>
              <MetricCard
                value="∞"
                label="Stylized directions you can explore"
                glow="shadow-[0_0_60px_rgba(59,130,246,0.08)] hover:shadow-[0_0_60px_rgba(59,130,246,0.16)]"
              />
            </Reveal>
            <Reveal delay={0.14}>
              <MetricCard
                value="24/7"
                label="Always-available creation workflow"
                glow="shadow-[0_0_60px_rgba(34,211,238,0.08)] hover:shadow-[0_0_60px_rgba(34,211,238,0.16)]"
              />
            </Reveal>
          </div>
        </div>
      </section>

      <section id="showcase" className="relative pb-20 pt-10">
        <div className="mx-auto w-full max-w-7xl px-6">
          <Reveal className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <SectionEyebrow label="Showcase" />
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
                <Balancer>Reference to Video</Balancer>
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
          </Reveal>

          <Reveal className="mt-10" delay={0.08}>
            <EmblaVideoCarousel
              items={showcase}
              title="Reference-to-Video Showcase"
            />
          </Reveal>
        </div>
      </section>

      <section id="features" className="relative py-16">
        <div className="mx-auto w-full max-w-7xl px-6">
          <Reveal className="mb-8">
            <SectionEyebrow label="Highlights" />
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
              <Balancer>Built for stylish motion creation</Balancer>
            </h2>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-2">
            <Reveal delay={0.03}>
              <FeatureCard
                title="First & Last Frames Control"
                desc="Upload the first and last frame images, and KOANimation creates smooth transitions in between."
                mediaSrc="/backgrounds/16.mp4"
                ctaHref="/tools"
                ctaLabel="Get Started"
                glowClass="shadow-[0_0_80px_rgba(168,85,247,0.08)] hover:shadow-[0_0_90px_rgba(168,85,247,0.16)]"
                badge="Frame Control"
              />
            </Reveal>
            <Reveal delay={0.1}>
              <FeatureCard
                title="Anime Art to Video"
                desc="Transform anime art into fluid animations with lifelike character motion and cinematic camera."
                mediaSrc="/backgrounds/7.mp4"
                ctaHref="/tools"
                ctaLabel="Get Started"
                glowClass="shadow-[0_0_80px_rgba(59,130,246,0.08)] hover:shadow-[0_0_90px_rgba(59,130,246,0.16)]"
                badge="Animation"
              />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="relative py-10">
        <div className="mx-auto w-full max-w-7xl px-6">
          <HoverSpotlightSection>
            <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl md:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0.01)_20%,rgba(0,0,0,0.08)_100%)]" />
              <div className="relative z-10">
                <SectionEyebrow
                  label="Visual playground"
                  icon={<Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />}
                />

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <Reveal delay={0.02}>
                    <BentoCard
                      title="Noir Mood"
                      desc="Dark cinematic frames with contrast, rain, glow, and pressure."
                      mediaSrc="/backgrounds/12.mp4"
                      badge="Atmosphere"
                      glowClass="shadow-[0_0_70px_rgba(168,85,247,0.08)] hover:shadow-[0_0_80px_rgba(168,85,247,0.16)]"
                      tall
                    />
                  </Reveal>
                  <Reveal delay={0.08}>
                    <BentoCard
                      title="Painterly Motion"
                      desc="Bring static illustrations into elegant motion without losing style."
                      mediaSrc="/backgrounds/14.mp4"
                      badge="Motion"
                      glowClass="shadow-[0_0_70px_rgba(59,130,246,0.08)] hover:shadow-[0_0_80px_rgba(59,130,246,0.16)]"
                    />
                  </Reveal>
                  <Reveal delay={0.14}>
                    <BentoCard
                      title="Scene Reveal"
                      desc="Use subtle camera drift and staged composition for drama."
                      mediaSrc="/backgrounds/17.mp4"
                      badge="Camera"
                      glowClass="shadow-[0_0_70px_rgba(34,211,238,0.08)] hover:shadow-[0_0_80px_rgba(34,211,238,0.16)]"
                    />
                  </Reveal>
                  <Reveal delay={0.2}>
                    <BentoCard
                      title="Character Presence"
                      desc="Maintain stronger subject identity while pushing cinematic framing."
                      mediaSrc="/backgrounds/6.mp4"
                      badge="Character"
                      glowClass="shadow-[0_0_70px_rgba(236,72,153,0.08)] hover:shadow-[0_0_80px_rgba(236,72,153,0.16)]"
                    />
                  </Reveal>
                  <Reveal delay={0.26}>
                    <BentoCard
                      title="Fantasy Energy"
                      desc="Use color, movement, and spatial depth for high-impact scenes."
                      mediaSrc="/backgrounds/2.mp4"
                      badge="Style"
                      glowClass="shadow-[0_0_70px_rgba(250,204,21,0.08)] hover:shadow-[0_0_80px_rgba(250,204,21,0.16)]"
                    />
                  </Reveal>
                </div>
              </div>
            </div>
          </HoverSpotlightSection>
        </div>
      </section>

      <section id="templates" className="relative pb-20 pt-10">
        <div className="mx-auto w-full max-w-7xl px-6">
          <Reveal className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:gap-6">
              <div>
                <SectionEyebrow
                  label="Stills into motion"
                  icon={<ImageIcon className="h-3.5 w-3.5 text-cyan-300" />}
                />
                <h2 className="mt-4 text-[42px] font-semibold tracking-[-0.03em] text-white md:text-5xl">
                  <Balancer>Image to Video</Balancer>
                </h2>
              </div>

              <div className="hidden h-10 w-px self-center bg-white/10 md:block" />

              <p className="max-w-2xl text-[13px] leading-[1.7] text-white/65 md:self-end md:text-sm md:leading-relaxed">
                Bring still images to life with dynamic motion that aligns with
                your vision.
              </p>
            </div>

            <div className="mt-1 flex items-center gap-3 md:mt-0">
              <AuthCTAButton href={TOOL_ROUTES.imageToVideo}>
                Open Studio
              </AuthCTAButton>
            </div>
          </Reveal>

          <Reveal className="mt-10" delay={0.08}>
            <EmblaVideoCarousel
              items={imageToVideo}
              title="Image-to-Video Showcase"
              large
            />
          </Reveal>
        </div>
      </section>

      <section className="relative py-14">
        <div className="mx-auto w-full max-w-7xl px-6">
          <Reveal className="mb-8">
            <SectionEyebrow
              label="Workflow"
              icon={<Layers3 className="h-3.5 w-3.5 text-emerald-300" />}
            />
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
              <Balancer>From idea to final motion</Balancer>
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
              A simple creative loop that still feels powerful enough for a real
              studio pipeline.
            </p>
          </Reveal>

          <StudioTimeline
            items={[
              {
                step: "01",
                title: "Choose a mode",
                desc: "Start from reference, image, or text depending on how much direction you already have.",
                glow: "shadow-[0_0_60px_rgba(168,85,247,0.08)] hover:shadow-[0_0_70px_rgba(168,85,247,0.16)]",
              },
              {
                step: "02",
                title: "Shape the look",
                desc: "Define mood, framing, motion type, and aesthetic intent for stronger results.",
                glow: "shadow-[0_0_60px_rgba(59,130,246,0.08)] hover:shadow-[0_0_70px_rgba(59,130,246,0.16)]",
              },
              {
                step: "03",
                title: "Generate iterations",
                desc: "Explore multiple passes until the pacing, energy, and atmosphere feel right.",
                glow: "shadow-[0_0_60px_rgba(236,72,153,0.08)] hover:shadow-[0_0_70px_rgba(236,72,153,0.16)]",
              },
              {
                step: "04",
                title: "Present your clip",
                desc: "Export work that feels polished, cinematic, and ready to show on your platform.",
                glow: "shadow-[0_0_60px_rgba(34,211,238,0.08)] hover:shadow-[0_0_70px_rgba(34,211,238,0.16)]",
              },
            ]}
          />
        </div>
      </section>

      <section className="relative py-14">
        <div className="mx-auto w-full max-w-7xl px-6">
          <Reveal className="mb-8">
            <SectionEyebrow
              label="Creator sentiment"
              icon={<Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />}
            />
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
              <Balancer>Why creators stay</Balancer>
            </h2>
          </Reveal>

          <div className="grid gap-4 lg:grid-cols-3">
            <Reveal delay={0.02}>
              <QuoteCard
                quote="It feels less like a random AI tool and more like a real place to shape aesthetic direction."
                name="Visual Story Creator"
                role="Atmospheric anime clips"
                glow="shadow-[0_0_70px_rgba(168,85,247,0.08)] hover:shadow-[0_0_80px_rgba(168,85,247,0.14)]"
              />
            </Reveal>
            <Reveal delay={0.08}>
              <QuoteCard
                quote="The interface already makes the output feel more premium. It pushes you into a stronger presentation mindset."
                name="Motion-first Artist"
                role="Stylized concept animation"
                glow="shadow-[0_0_70px_rgba(59,130,246,0.08)] hover:shadow-[0_0_80px_rgba(59,130,246,0.14)]"
              />
            </Reveal>
            <Reveal delay={0.14}>
              <QuoteCard
                quote="The best part is being able to explore cinematic tone while keeping the subject identity much more intentional."
                name="Anime Editor"
                role="Reference-driven workflow"
                glow="shadow-[0_0_70px_rgba(34,211,238,0.08)] hover:shadow-[0_0_80px_rgba(34,211,238,0.14)]"
              />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="relative py-14">
        <div className="mx-auto w-full max-w-7xl px-6">
          <Reveal>
            <GlassCard className="p-8 md:p-10" hover={false}>
              <div className="relative z-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
                <div>
                  <SectionEyebrow
                    label="Why it lands"
                    icon={<Wand2 className="h-3.5 w-3.5 text-amber-300" />}
                  />
                  <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
                    <Balancer>Beauty with structure</Balancer>
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/68 md:text-base">
                    The goal is not to drown the screen in effects. It is to
                    make every interaction feel purposeful, cinematic, and
                    elegant — like a premium studio environment rather than a
                    noisy AI tool.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <BenefitRow
                    title="Sharper hierarchy"
                    desc="Cleaner spacing and stronger composition make the page easier to read while still feeling high-end."
                    accent="bg-[linear-gradient(to_right,rgba(168,85,247,0.95),rgba(59,130,246,0.85))]"
                  />
                  <BenefitRow
                    title="Luxury glass layers"
                    desc="Refined borders, inner highlights, and subtle sheen make surfaces feel expensive instead of flat."
                    accent="bg-[linear-gradient(to_right,rgba(59,130,246,0.95),rgba(34,211,238,0.85))]"
                  />
                  <BenefitRow
                    title="Controlled motion"
                    desc="Slow floating light and premium hover transitions add life without making the interface feel chaotic."
                    accent="bg-[linear-gradient(to_right,rgba(217,70,239,0.95),rgba(168,85,247,0.85))]"
                  />
                  <BenefitRow
                    title="Better mood"
                    desc="Darker hero focus zones and softer background handling let your visuals breathe more beautifully."
                    accent="bg-[linear-gradient(to_right,rgba(250,204,21,0.95),rgba(59,130,246,0.85))]"
                  />
                </div>
              </div>
            </GlassCard>
          </Reveal>
        </div>
      </section>

      <section id="resources" className="relative py-16">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-start">
            <Reveal>
              <div>
                <SectionEyebrow label="Resources" />
                <h2 className="mt-4 text-5xl font-semibold leading-[0.95] tracking-[-0.04em] text-white">
                  <Balancer>
                    Frequently
                    <br />
                    Asked
                    <br />
                    Questions
                  </Balancer>
                </h2>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
                  Find answers about features, usage, workflow, and how to get
                  the best results.
                </p>
              </div>
            </Reveal>

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
                <Reveal key={item.q} delay={i * 0.06}>
                  <FAQItem
                    q={item.q}
                    a={item.a}
                    open={faqOpen === i}
                    onToggle={() => setFaqOpen((cur) => (cur === i ? null : i))}
                  />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative pb-24 pt-8">
        <div className="mx-auto w-full max-w-7xl px-6">
          <Reveal>
            <GlassCard className="overflow-hidden shadow-[0_40px_140px_rgba(0,0,0,0.55)] hover:shadow-[0_55px_180px_rgba(0,0,0,0.68)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_left,rgba(168,85,247,0.15),transparent_30%)]" />
              <video
                className="h-[300px] w-full object-cover transition duration-700 group-hover:scale-[1.03] md:h-[360px]"
                src="/backgrounds/15.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              />
              <div className="absolute inset-0 bg-black/62" />
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <div>
                  <SectionEyebrow
                    label="Start creating"
                    icon={<Play className="h-3.5 w-3.5 text-cyan-300" />}
                  />
                  <h3 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white md:text-5xl">
                    <Balancer>Embrace Your Creativity</Balancer>
                  </h3>
                  <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/68 md:text-base">
                    Step into a more cinematic creation flow and build motion
                    that feels intentional, atmospheric, and uniquely yours.
                  </p>
                  <AuthCTAButton
                    href={TOOL_ROUTES.referenceToVideo}
                    className="mt-6 border-0 bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.30)] hover:bg-blue-500 hover:shadow-[0_0_60px_rgba(37,99,235,0.42)]"
                  >
                    Try it now
                  </AuthCTAButton>
                </div>
              </div>
            </GlassCard>
          </Reveal>

          <div className="mt-10">
            <GlowDivider />
          </div>

          <Reveal className="mt-10 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="text-sm font-semibold text-white">
                KOANimation
              </div>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/58">
                A creator-first studio for aesthetic anime motion, cinematic
                presentation, and reference-aware workflows.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <div className="text-sm font-semibold text-white">Explore</div>
                <div className="mt-3 flex flex-col gap-2 text-sm text-white/58">
                  <a className="transition hover:text-white/85" href="#features">
                    Features
                  </a>
                  <a className="transition hover:text-white/85" href="#showcase">
                    Showcase
                  </a>
                  <a
                    className="transition hover:text-white/85"
                    href="#resources"
                  >
                    FAQ
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <div className="text-sm font-semibold text-white">Product</div>
                <div className="mt-3 flex flex-col gap-2 text-sm text-white/58">
                  <Link
                    className="transition hover:text-white/85"
                    href="/pricing"
                  >
                    Pricing
                  </Link>
                  <Link
                    className="transition hover:text-white/85"
                    href="/roadmap"
                  >
                    Roadmap
                  </Link>
                  <Link className="transition hover:text-white/85" href="/tools">
                    Tools
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <div className="text-sm font-semibold text-white">Studio</div>
                <div className="mt-3 flex flex-col gap-2 text-sm text-white/58">
                  <span>Reference workflows</span>
                  <span>Anime motion</span>
                  <span>Cinematic output</span>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="mt-8 text-sm text-white/45">
            © {new Date().getFullYear()} KOANimation
          </div>
        </div>
      </section>
    </main>
  );
}