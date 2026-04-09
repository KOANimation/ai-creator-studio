"use client";

import Link from "next/link";
import Image from "next/image";
import React, {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Lenis from "lenis";
import { motion } from "framer-motion";
import Tilt from "react-parallax-tilt";
import Marquee from "react-fast-marquee";
import Balancer from "react-wrap-balancer";
import {
  ArrowRight,
  Clapperboard,
  ImageIcon,
  Layers3,
  LogOut,
  Play,
  ScanSearch,
  Settings,
  Sparkles,
  Wand2,
  PanelLeft,
  Film,
  History,
  ChevronRight,
  Workflow,
  ShieldCheck,
  Stars,
  Command,
  House,
  Coins,
  CreditCard,
} from "lucide-react";
import { createClient } from "@/app/lib/supabase/client";

type VideoToolKey = "reference-to-video" | "image-to-video" | "text-to-video";
type ImageToolKey = "reference-to-image" | "text-to-image";

const VIDEO_TOOLS: {
  key: VideoToolKey;
  label: string;
  description: string;
  icon: ReactNode;
  accent: string;
}[] = [
  {
    key: "reference-to-video",
    label: "Reference to Video",
    description:
      "Use a reference to guide video generation with stronger identity and style consistency.",
    icon: <ScanSearch className="h-5 w-5" />,
    accent: "from-violet-400/25 via-fuchsia-400/10 to-transparent",
  },
  {
    key: "image-to-video",
    label: "Image to Video",
    description: "Bring a still image to life as a cinematic animated shot.",
    icon: <Clapperboard className="h-5 w-5" />,
    accent: "from-cyan-400/25 via-sky-400/10 to-transparent",
  },
  {
    key: "text-to-video",
    label: "Text to Video",
    description: "Generate a video scene directly from a prompt.",
    icon: <Wand2 className="h-5 w-5" />,
    accent: "from-amber-300/20 via-orange-300/10 to-transparent",
  },
];

const IMAGE_TOOLS: {
  key: ImageToolKey;
  label: string;
  description: string;
  icon: ReactNode;
  accent: string;
}[] = [
  {
    key: "reference-to-image",
    label: "Reference to Image",
    description: "Use image references to guide a controlled image generation.",
    icon: <Layers3 className="h-5 w-5" />,
    accent: "from-emerald-400/20 via-cyan-300/10 to-transparent",
  },
  {
    key: "text-to-image",
    label: "Text to Image",
    description: "Generate a polished image from a text prompt.",
    icon: <ImageIcon className="h-5 w-5" />,
    accent: "from-pink-400/20 via-violet-300/10 to-transparent",
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

function AIProcessingPreview() {
  return (
    <GlassPanel className="overflow-hidden">
      <div className="relative z-10 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white/92">
              Live Preview
            </div>
            <div className="mt-1 text-xs text-white/50">
              Simulated generation preview
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/70">
            generating…
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="relative h-24 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
            >
              <div className="absolute inset-0 ai-shimmer" />
              <div className="absolute inset-0 ai-scanline" />
              <div className="absolute inset-x-3 bottom-2 flex items-center justify-between text-[11px] text-white/60">
                <span>Frame {i + 1}</span>
                <span>
                  {i === 0 ? "queued" : i === 1 ? "rendering" : "refining"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
          Tip: this panel can later show real generation progress, estimated
          time, and finished outputs.
        </div>
      </div>
    </GlassPanel>
  );
}

function ToolCard({
  title,
  description,
  accent,
  icon,
  onClick,
  badge,
}: {
  title: string;
  description: string;
  accent: string;
  icon: ReactNode;
  onClick: () => void;
  badge: string;
}) {
  return (
    <Tilt
      tiltMaxAngleX={5}
      tiltMaxAngleY={5}
      glareEnable
      glareMaxOpacity={0.06}
      scale={1.01}
      transitionSpeed={1800}
      className="rounded-3xl"
    >
      <button
        type="button"
        onClick={onClick}
        className="group relative block w-full cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-black/24 p-5 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
            accent
          )}
        />
        <div className="pointer-events-none absolute inset-[1px] rounded-[23px] border border-white/[0.06]" />
        <div className="pointer-events-none absolute -right-10 top-0 h-24 w-24 rounded-full bg-white/10 blur-2xl opacity-20 transition duration-300 group-hover:opacity-35" />

        <div className="relative z-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="inline-flex rounded-2xl border border-white/10 bg-black/25 p-3 text-white/85">
              {icon}
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/65">
              {badge}
            </div>
          </div>

          <div className="text-lg font-semibold text-white">{title}</div>
          <div className="mt-2 text-sm leading-relaxed text-white/62">
            {description}
          </div>

          <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/80 transition group-hover:translate-x-1 group-hover:text-white">
            Launch tool
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </button>
    </Tilt>
  );
}

function RecentCreationsStrip() {
  const items = useMemo(
    () => [
      { label: "OVA 80s • Rainy City", src: "/backgrounds/1.mp4" },
      { label: "Black Cat • Cinematic", src: "/backgrounds/2.mp4" },
      { label: "Spider Scene • Neon", src: "/backgrounds/3.mp4" },
      { label: "Mystic Forest • VHS", src: "/backgrounds/4.mp4" },
      { label: "Hero Close-up • Film Grain", src: "/backgrounds/5.mp4" },
      { label: "Night Alley • Moody Blue", src: "/backgrounds/6.mp4" },
    ],
    []
  );

  return (
    <GlassPanel className="overflow-hidden">
      <div className="relative z-10 flex items-center justify-between px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-white/90">
            Recent creations
          </div>
          <div className="mt-1 text-xs text-white/50">
            Live inspiration strip
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/60">
          live feed
        </div>
      </div>

      <div className="pb-5">
        <Marquee speed={28} gradient={false} pauseOnHover>
          {items.concat(items).map((it, idx) => (
            <div
              key={`${it.src}-${idx}`}
              className="group relative mx-2 h-28 w-[220px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/28"
            >
              <video
                className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.03] group-hover:opacity-100"
                src={it.src}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3 text-[11px] text-white/85">
                {it.label}
              </div>
            </div>
          ))}
        </Marquee>
      </div>
    </GlassPanel>
  );
}

function QuickStat({
  label,
  value,
  icon,
  className = "",
  iconClassName = "",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <GlassPanel className={cn("p-5", className)}>
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">
            {label}
          </div>
          <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
        </div>
        <div
          className={cn(
            "inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white/80",
            iconClassName
          )}
        >
          {icon}
        </div>
      </div>
    </GlassPanel>
  );
}

function SidebarSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-1 text-[11px] font-semibold tracking-[0.18em] text-white/40">
      {children}
    </div>
  );
}

export default function ToolsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useLenisScroll(true);

  const [mounted, setMounted] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  const refreshWallet = async (userId: string) => {
    const { data, error } = await supabase
      .from("credit_wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      setCredits(data.balance);
    } else {
      setCredits(0);
    }
  };

  useEffect(() => {
    let active = true;

    async function loadUserAndCredits() {
      setMounted(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      setIsAuthed(!!user);

      if (!user) {
        setUserEmail(null);
        setCredits(null);
        return;
      }

      setUserEmail(user.email ?? null);
      await refreshWallet(user.id);
    }

    void loadUserAndCredits();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;

      const user = session?.user ?? null;
      setIsAuthed(!!user);

      if (!user) {
        setUserEmail(null);
        setCredits(null);
        return;
      }

      setUserEmail(user.email ?? null);
      await refreshWallet(user.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const logout = async () => {
    await supabase.auth.signOut();
    setIsAuthed(false);
    setUserEmail(null);
    setCredits(null);
    router.replace("/tools");
  };

  const goVideo = (tool: VideoToolKey) => {
    router.push(`/create/video?tab=${tool}`);
  };

  const goImage = (tool: ImageToolKey) => {
    router.push(`/create/image?tab=${tool}`);
  };

  const goSiteHome = () => {
    router.push("/");
  };

  const goPricing = () => {
    router.push("/pricing");
  };

  const heroVideos = useMemo(
    () => ["/backgrounds/12.mp4", "/backgrounds/14.mp4", "/backgrounds/6.mp4"],
    []
  );

  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setHeroIdx((i) => (i + 1) % heroVideos.length);
    }, 9000);
    return () => window.clearInterval(t);
  }, [heroVideos.length]);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white">
      <style>{`
        .ai-shimmer {
          background: linear-gradient(
            110deg,
            rgba(255, 255, 255, 0.02) 0%,
            rgba(255, 255, 255, 0.1) 30%,
            rgba(255, 255, 255, 0.02) 60%
          );
          transform: translateX(-40%);
          animation: ko-shimmer 1.6s ease-in-out infinite;
        }

        @keyframes ko-shimmer {
          0% {
            transform: translateX(-60%);
          }
          100% {
            transform: translateX(60%);
          }
        }

        .ai-scanline {
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(255, 255, 255, 0.06) 50%,
            transparent 100%
          );
          transform: translateY(-100%);
          animation: ko-scan 2.2s ease-in-out infinite;
          mix-blend-mode: screen;
          opacity: 0.5;
        }

        @keyframes ko-scan {
          0% {
            transform: translateY(-120%);
          }
          100% {
            transform: translateY(120%);
          }
        }
      `}</style>

      <ScrollProgress />
      <WallpaperRevealBackground src="/wallpaper.jpg" radius={240} />

      <div className="relative z-10 mx-auto w-full max-w-[1480px] px-4 py-4 md:px-6">
        <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <GlassPanel className="overflow-hidden">
              <div className="relative z-10 p-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-[56px] w-[56px] items-center justify-center overflow-visible">
                    <div className="relative h-[56px] w-[56px]">
                      <Image
                        src="/koanimationlogo.png"
                        alt="KOANimation logo"
                        fill
                        priority
                        className="object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.45)]"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-lg font-semibold tracking-tight">
                      KOANimation
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-violet-200/50">
                      Tools
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center gap-2 text-sm text-white/85">
                    <Command className="h-4 w-4" />
                    Creation Home
                  </div>
                  <div className="mt-2 text-xs leading-relaxed text-white/55">
                    Pick a workflow, launch a workspace, and keep your creation
                    process clean and focused.
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <SidebarSectionTitle>Navigation</SidebarSectionTitle>

                  <button
                    type="button"
                    onClick={goSiteHome}
                    className="group flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/20 bg-white/[0.07] px-4 py-3 text-left transition hover:bg-white/[0.1]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/80">
                        <House className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Home
                        </div>
                        <div className="mt-1 text-xs text-white/55">
                          Return to the KOANimation homepage
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-1 group-hover:text-white/80" />
                  </button>

                  <SidebarSectionTitle>AI Video</SidebarSectionTitle>
                  <div className="space-y-3">
                    {VIDEO_TOOLS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => goVideo(item.key)}
                        className="group w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/80">
                              {item.icon}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {item.label}
                              </div>
                              <div className="mt-1 text-xs leading-relaxed text-white/55">
                                {item.description}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-white/80" />
                        </div>
                      </button>
                    ))}
                  </div>

                  <SidebarSectionTitle>AI Image</SidebarSectionTitle>
                  <div className="space-y-3">
                    {IMAGE_TOOLS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => goImage(item.key)}
                        className="group w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/80">
                              {item.icon}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {item.label}
                              </div>
                              <div className="mt-1 text-xs leading-relaxed text-white/55">
                                {item.description}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-white/80" />
                        </div>
                      </button>
                    ))}
                  </div>

                  <SidebarSectionTitle>Account</SidebarSectionTitle>

                  <button
                    type="button"
                    onClick={goPricing}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/80 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <CreditCard className="h-4 w-4 text-white/55" />
                    Pricing & credits
                  </button>

                  {mounted && isAuthed && (
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/80 transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <LogOut className="h-4 w-4 text-white/55" />
                      Log out
                    </button>
                  )}
                </div>
              </div>
            </GlassPanel>
          </aside>

          <main className="min-w-0 space-y-6">
            <GlassPanel className="overflow-hidden">
              <video
                key={heroVideos[heroIdx]}
                className="absolute inset-0 h-full w-full object-cover opacity-35"
                src={heroVideos[heroIdx]}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_40%,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0.65)_62%,rgba(0,0,0,0.88)_100%)]" />

              <div className="relative z-10 grid gap-6 p-6 lg:grid-cols-[minmax(0,1.15fr)_380px] lg:p-8">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55 }}
                  className="min-w-0"
                >
                  <SectionEyebrow
                    label="KOANimation Studio"
                    icon={<Sparkles className="h-3.5 w-3.5 text-violet-300" />}
                  />

                  <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] md:text-5xl">
                    <Balancer>
                      Build cinematic AI visuals with a cleaner studio workflow.
                    </Balancer>
                  </h1>

                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/68 md:text-base">
                    Generate anime-inspired images and videos from text or
                    references, organized into focused workspaces that feel
                    closer to a premium creation suite.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => goVideo("reference-to-video")}
                      className="cursor-pointer rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-[1.03] hover:bg-white/90"
                    >
                      Start with Video
                    </button>
                    <button
                      type="button"
                      onClick={() => goImage("text-to-image")}
                      className="cursor-pointer rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                    >
                      Start with Image
                    </button>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-white/55">
                    {[
                      "OVA 80s style",
                      "cinematic motion",
                      "reference consistency",
                      "workspace UI",
                    ].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.08 }}
                  className="min-w-0 self-end"
                >
                  <AIProcessingPreview />
                </motion.div>
              </div>
            </GlassPanel>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <QuickStat
                label="Credits"
                value={credits === null ? "..." : `${credits}`}
                icon={<Coins className="h-5 w-5" />}
                className="border-yellow-300/20 shadow-[0_0_0_1px_rgba(250,204,21,0.10),0_0_28px_rgba(250,204,21,0.12),0_24px_80px_rgba(0,0,0,0.32)]"
                iconClassName="border-yellow-300/20 bg-yellow-300/10 text-yellow-200 shadow-[0_0_22px_rgba(250,204,21,0.22)]"
              />
              <QuickStat
                label="Status"
                value={isAuthed ? "Logged in" : "Guest"}
                icon={<ShieldCheck className="h-5 w-5" />}
              />
              <QuickStat
                label="Workflows"
                value="5 Tools"
                icon={<Workflow className="h-5 w-5" />}
              />
              <QuickStat
                label="Session"
                value="Ready"
                icon={<Stars className="h-5 w-5" />}
              />
            </div>

            <RecentCreationsStrip />

            <div className="grid gap-6 xl:grid-cols-2">
              <GlassPanel className="p-6">
                <div className="relative z-10">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold tracking-[0.18em] text-white/40">
                        AI VIDEO CREATION
                      </div>
                      <div className="mt-1 text-xl font-semibold">
                        Video tools
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/60">
                      reference / image / text
                    </div>
                  </div>

                  <div className="space-y-4">
                    {VIDEO_TOOLS.map((tool) => (
                      <ToolCard
                        key={tool.key}
                        title={tool.label}
                        description={tool.description}
                        accent={tool.accent}
                        icon={tool.icon}
                        badge="video"
                        onClick={() => goVideo(tool.key)}
                      />
                    ))}
                  </div>
                </div>
              </GlassPanel>

              <GlassPanel className="p-6">
                <div className="relative z-10">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold tracking-[0.18em] text-white/40">
                        AI IMAGE CREATION
                      </div>
                      <div className="mt-1 text-xl font-semibold">
                        Image tools
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/60">
                      reference / text
                    </div>
                  </div>

                  <div className="space-y-4">
                    {IMAGE_TOOLS.map((tool) => (
                      <ToolCard
                        key={tool.key}
                        title={tool.label}
                        description={tool.description}
                        accent={tool.accent}
                        icon={tool.icon}
                        badge="image"
                        onClick={() => goImage(tool.key)}
                      />
                    ))}
                  </div>
                </div>
              </GlassPanel>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <GlassPanel className="p-6">
                <div className="relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white/85">
                      <PanelLeft className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-lg font-semibold">
                        Creation flow
                      </div>
                      <div className="mt-1 text-sm text-white/55">
                        Simple structure, premium feel
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {[
                      {
                        title: "Pick a workspace",
                        desc: "Choose the right workflow for text, reference, image, or motion generation.",
                      },
                      {
                        title: "Create with focus",
                        desc: "Launch directly into a dedicated environment instead of a cluttered all-in-one page.",
                      },
                      {
                        title: "Scale output",
                        desc: "Keep history, credits, settings, and future generation controls in one polished system.",
                      },
                    ].map((step, i) => (
                      <div
                        key={step.title}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="text-[11px] font-semibold tracking-[0.2em] text-white/35">
                          0{i + 1}
                        </div>
                        <div className="mt-3 text-base font-semibold text-white">
                          {step.title}
                        </div>
                        <div className="mt-2 text-sm leading-relaxed text-white/58">
                          {step.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassPanel>

              <GlassPanel className="p-6">
                <div className="relative z-10">
                  <div className="text-lg font-semibold">Quick actions</div>
                  <div className="mt-1 text-sm text-white/55">
                    Jump back into the studio faster
                  </div>

                  <div className="mt-5 space-y-3">
                    <button
                      type="button"
                      onClick={() => goVideo("reference-to-video")}
                      className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-3">
                        <History className="h-4 w-4 text-white/65" />
                        <span className="text-sm text-white/82">
                          Open video studio
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/35" />
                    </button>

                    <button
                      type="button"
                      onClick={goPricing}
                      className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-3">
                        <Settings className="h-4 w-4 text-white/65" />
                        <span className="text-sm text-white/82">
                          Pricing & plans
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/35" />
                    </button>

                    <button
                      type="button"
                      onClick={() => goVideo("text-to-video")}
                      className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-3">
                        <Play className="h-4 w-4 text-white/65" />
                        <span className="text-sm text-white/82">
                          Quick start video
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/35" />
                    </button>

                    <button
                      type="button"
                      onClick={() => goImage("text-to-image")}
                      className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-3">
                        <ImageIcon className="h-4 w-4 text-white/65" />
                        <span className="text-sm text-white/82">
                          Quick start image
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/35" />
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-white/55">
                    Logged in as: {userEmail ?? "Not logged in"}
                  </div>
                </div>
              </GlassPanel>
            </div>

            <GlassPanel className="overflow-hidden">
              <div className="relative z-10 flex flex-col items-center justify-center px-6 py-12 text-center">
                <SectionEyebrow
                  label="Studio access"
                  icon={<Film className="h-3.5 w-3.5 text-cyan-300" />}
                />
                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
                  <Balancer>
                    A cleaner tool home that feels like a real creative suite
                  </Balancer>
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/65 md:text-base">
                  This is now designed more like a premium studio dashboard:
                  cinematic hero, polished cards, smoother motion, stronger
                  hierarchy, and dedicated tool launches.
                </p>

                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => goVideo("reference-to-video")}
                    className="cursor-pointer rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    Open Video Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => goImage("reference-to-image")}
                    className="cursor-pointer rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Open Image Workspace
                  </button>
                </div>
              </div>
            </GlassPanel>
          </main>
        </div>
      </div>
    </div>
  );
}