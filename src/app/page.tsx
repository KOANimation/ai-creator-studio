// src/app/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
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

/**
 * ✅ REAL auth check via Supabase session
 */
async function isLoggedIn(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * ✅ Auth-gated navigation:
 * - logged in → go to target
 * - else → /login?redirect=<target>
 */
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

/** ✅ Navbar item that uses auth-gated navigation */
function AuthMenuItem({ href, label }: { href: string; label: string }) {
  const go = useAuthNavigate();

  return (
    <button
      type="button"
      onClick={() => go(href)}
      className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-[13px] text-white/75 hover:text-white hover:bg-white/5 transition"
    >
      <span>{label}</span>
      <span className="text-white/30">→</span>
    </button>
  );
}

/** ✅ CTA button that uses auth-gated navigation */
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
        "rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** ✅ Wallpaper reveal (spotlight) behind the black */
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
          className={[
            "absolute top-1/2 z-30 -translate-y-1/2",
            "left-2 md:-left-10",
            "rounded-full border border-white/10 bg-black/45 p-3 md:p-4",
            "text-white/90 backdrop-blur hover:bg-black/60",
            "shadow-[0_18px_70px_rgba(0,0,0,0.55)]",
            "focus:outline-none focus:ring-2 focus:ring-white/20",
          ].join(" ")}
        >
          <span className="text-2xl md:text-3xl leading-none">‹</span>
        </button>

        <button
          aria-label="Next"
          onClick={next}
          className={[
            "absolute top-1/2 z-30 -translate-y-1/2",
            "right-2 md:-right-10",
            "rounded-full border border-white/10 bg-black/45 p-3 md:p-4",
            "text-white/90 backdrop-blur hover:bg-black/60",
            "shadow-[0_18px_70px_rgba(0,0,0,0.55)]",
            "focus:outline-none focus:ring-2 focus:ring-white/20",
          ].join(" ")}
        >
          <span className="text-2xl md:text-3xl leading-none">›</span>
        </button>

        <div className="mt-5 text-center text-white/65">
          <span className="text-sm">{active.title}</span>
        </div>
      </div>
    </div>
  );
}

/** Vidu-like "Image to Video" carousel (2 thumbs + chevrons) */
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

          <div className="pointer-events-none absolute bottom-6 right-7 text-white/35 text-sm font-semibold tracking-tight">
            KOANimation
          </div>

          <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 w-[min(92%,520px)] -translate-x-1/2">
            <div className="pointer-events-auto flex items-center justify-center gap-4 rounded-[18px] border border-white/10 bg-black/50 px-4 py-3 shadow-[0_22px_95px_rgba(0,0,0,0.62)] backdrop-blur">
              <button
                onClick={prev}
                aria-label="Select previous"
                className="relative overflow-hidden rounded-xl border border-white/10 hover:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20"
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
                className="relative overflow-hidden rounded-xl border border-white/10 hover:border-white/20 transition focus:outline-none focus:ring-2 focus:ring-white/20"
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
          className={[
            "absolute top-1/2 z-30 -translate-y-1/2",
            "left-2 md:-left-12",
            "rounded-full border border-white/10 bg-black/45 p-3 md:p-4",
            "text-white/90 backdrop-blur hover:bg-black/60",
            "shadow-[0_18px_70px_rgba(0,0,0,0.55)]",
            "focus:outline-none focus:ring-2 focus:ring-white/20",
          ].join(" ")}
        >
          <span className="text-2xl md:text-3xl leading-none">‹</span>
        </button>

        <button
          aria-label="Next"
          onClick={next}
          className={[
            "absolute top-1/2 z-30 -translate-y-1/2",
            "right-2 md:-right-12",
            "rounded-full border border-white/10 bg-black/45 p-3 md:p-4",
            "text-white/90 backdrop-blur hover:bg-black/60",
            "shadow-[0_18px_70px_rgba(0,0,0,0.55)]",
            "focus:outline-none focus:ring-2 focus:ring-white/20",
          ].join(" ")}
        >
          <span className="text-2xl md:text-3xl leading-none">›</span>
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
}: {
  title: string;
  desc: string;
  mediaSrc: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_110px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-md">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-white/25" />
            Feature
          </div>
          <h3 className="text-xl font-semibold text-white md:text-2xl">
            {title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-white/70">{desc}</p>

          <Link
            href={ctaHref}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-5 py-2.5 text-sm font-semibold text-white/85 backdrop-blur hover:bg-black/50"
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
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-left hover:bg-white/7 transition backdrop-blur"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-white/90 sm:text-base">
          {q}
        </span>
        <span className="text-white/60 text-xl leading-none">
          {open ? "–" : "+"}
        </span>
      </div>
      {open && (
        <div className="mt-3 text-sm leading-relaxed text-white/70">{a}</div>
      )}
    </button>
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
    <main className="relative min-h-screen text-white overflow-x-hidden">
      <WallpaperRevealBackground src="/wallpaper.jpg" radius={240} />

      {/* NAV */}
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
              <div className="relative group">
                <a
                  className="transition hover:text-white inline-flex items-center gap-2"
                  href="#features"
                >
                  Features
                  <span className="text-white/35 text-[12px] leading-none translate-y-[1px]">
                    ▾
                  </span>
                </a>

                <div className="absolute left-0 top-full h-4 w-full" />

                <div
                  className={[
                    "absolute left-0 top-full z-[3000] w-64 mt-2",
                    "rounded-2xl border border-white/10 bg-black/70 backdrop-blur",
                    "shadow-[0_18px_70px_rgba(0,0,0,0.55)]",
                    "opacity-0 translate-y-2 pointer-events-none",
                    "group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto",
                    "transition duration-200",
                  ].join(" ")}
                >
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

              <a className="transition hover:text-white" href="#templates">
                Templates
              </a>

              <Link className="transition hover:text-white" href="/pricing">
                Pricing
              </Link>

              <a className="transition hover:text-white" href="#resources">
                Resources
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <AuthCTAButton href="/tools">Try KOANimation</AuthCTAButton>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative min-h-screen overflow-hidden">
        <FloatingMediaWall />

        <div className="absolute inset-0 z-[1] bg-black/55" />
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_45%,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.70)_70%,rgba(0,0,0,0.90)_100%)]" />
        <div className="absolute inset-0 z-[3] bg-[radial-gradient(circle_at_25%_25%,rgba(168,85,247,0.14),transparent_60%),radial-gradient(circle_at_75%_40%,rgba(147,51,234,0.10),transparent_65%)]" />

        <div className="absolute inset-0 z-[4]">
          <Particles
            id="tsparticles"
            init={particlesInit}
            options={{
              fullScreen: false,
              background: { color: "transparent" },
              fpsLimit: 60,
              particles: {
                number: { value: 18, density: { enable: true, area: 1100 } },
                color: { value: "#a855f7" },
                opacity: { value: 0.08 },
                size: { value: { min: 1, max: 2 } },
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

        <div className="absolute inset-0 z-[1000] flex items-center justify-center px-6 text-center pointer-events-none">
          <div className="select-none">
            <div className="text-4xl font-semibold tracking-tight text-white md:text-6xl drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
              Old Soul.
              <span className="block">New Motion.</span>
              <span className="block">KOANimation.</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[10] h-28 bg-gradient-to-b from-transparent to-black/80" />
      </section>

      {/* Reference to Video */}
      <section className="relative pb-20 pt-16">
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

      {/* Feature Cards */}
      <section id="features" className="relative py-16">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <FeatureCard
              title="First & Last Frames Control"
              desc="Upload the first and last frame images, and KOANimation creates smooth transitions in between."
              mediaSrc="/backgrounds/16.mp4"
              ctaHref="/tools"
              ctaLabel="Get Started"
            />
            <FeatureCard
              title="Anime Art to Video"
              desc="Transform anime art into fluid animations with lifelike character motion and cinematic camera."
              mediaSrc="/backgrounds/7.mp4"
              ctaHref="/tools"
              ctaLabel="Get Started"
            />
          </div>
        </div>
      </section>

      {/* Image to Video */}
      <section id="templates" className="relative pb-20 pt-6">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:gap-6">
              <h2 className="text-[42px] font-semibold tracking-[-0.02em] text-white md:text-5xl">
                Image to Video
              </h2>

              <span className="text-white/20 text-2xl leading-none md:hidden">
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

      {/* FAQ */}
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

      {/* CTA */}
      <section className="relative pb-24 pt-8">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur">
            <video
              className="h-[300px] w-full object-cover md:h-[360px]"
              src="/backgrounds/15.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <div>
                <h3 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  Embrace Your Creativity
                </h3>
                <AuthCTAButton
                  href={TOOL_ROUTES.referenceToVideo}
                  className="mt-6 bg-blue-600 hover:bg-blue-500 border-0"
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