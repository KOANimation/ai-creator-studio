"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

type VideoToolKey = "reference-to-video" | "image-to-video" | "text-to-video";
type ImageToolKey = "reference-to-image" | "text-to-image";

const VIDEO_TOOLS: { key: VideoToolKey; label: string; description: string }[] = [
  {
    key: "reference-to-video",
    label: "Reference to Video",
    description: "Use a reference to guide the video generation.",
  },
  {
    key: "image-to-video",
    label: "Image to Video",
    description: "Bring an image to life as a short cinematic video.",
  },
  {
    key: "text-to-video",
    label: "Text to Video",
    description: "Generate a video from a text prompt.",
  },
];

const IMAGE_TOOLS: { key: ImageToolKey; label: string; description: string }[] = [
  {
    key: "reference-to-image",
    label: "Reference to Image",
    description: "Use image references to guide an image generation.",
  },
  {
    key: "text-to-image",
    label: "Text to Image",
    description: "Generate an image from a text prompt.",
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

function TiltCard({
  children,
  className = "",
  glare = true,
}: {
  children: React.ReactNode;
  className?: string;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    transform: "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)",
  });
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({
    opacity: 0,
    transform: "translate(-50%, -50%)",
  });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;

    const rotateY = (px - 0.5) * 8;
    const rotateX = (0.5 - py) * 8;

    setStyle({
      transform: `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0px)`,
    });

    if (glare) {
      setGlareStyle({
        opacity: 0.14,
        transform: `translate(${(px - 0.5) * 18}px, ${(py - 0.5) * 18}px)`,
      });
    }
  };

  const onLeave = () => {
    setStyle({
      transform: "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)",
      transition: "transform 220ms ease",
    });
    setGlareStyle({
      opacity: 0,
      transform: "translate(-50%, -50%)",
      transition: "opacity 220ms ease, transform 220ms ease",
    });

    window.setTimeout(() => {
      setStyle((s) => ({ ...s, transition: undefined }));
      setGlareStyle((s) => ({ ...s, transition: undefined }));
    }, 240);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative will-change-transform ${className}`}
      style={style}
    >
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
          aria-hidden
        >
          <div
            className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white blur-3xl"
            style={glareStyle}
          />
        </div>
      )}
      {children}
    </div>
  );
}

function AILoadingPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/32 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/90">Live Preview</div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
          generating…
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="relative h-24 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
          >
            <div className="absolute inset-0 ai-shimmer" />
            <div className="absolute inset-0 ai-scanline" />
            <div className="absolute bottom-2 left-2 text-[11px] text-white/60">
              Frame {i + 1}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-white/55">
        Tip: this will later show real generation progress + results.
      </div>
    </div>
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

  const loop = [...items, ...items];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/18 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm font-semibold text-white/85">Recent creations</div>
        <div className="text-xs text-white/50">live feed</div>
      </div>

      <div className="relative overflow-hidden">
        <div className="marquee flex gap-3 px-4 pb-4">
          {loop.map((it, idx) => (
            <div
              key={`${it.src}-${idx}`}
              className="group relative h-24 w-[200px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/28"
            >
              <video
                className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                src={it.src}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-[11px] text-white/80">
                {it.label}
              </div>
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/90 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/90 to-transparent" />
      </div>
    </div>
  );
}

function ToolsHome({
  onChooseVideo,
  onChooseImage,
}: {
  onChooseVideo: (key: VideoToolKey) => void;
  onChooseImage: (key: ImageToolKey) => void;
}) {
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
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/18 backdrop-blur-xl">
        <video
          key={heroVideos[heroIdx]}
          className="absolute inset-0 h-full w-full object-cover opacity-38"
          src={heroVideos[heroIdx]}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_40%,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0.65)_62%,rgba(0,0,0,0.88)_100%)]" />

        <div className="relative grid gap-6 p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:p-10">
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-widest text-white/60">
              KOANIMATION STUDIO
            </div>
            <h2 className="mt-3 text-4xl font-semibold leading-tight">
              Create cinematic AI worlds.
            </h2>
            <p className="mt-4 max-w-xl text-white/70">
              Generate anime-inspired visuals and videos from text or references —
              built for storytelling.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => onChooseVideo("reference-to-video")}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-[1.03] hover:bg-white/90"
              >
                Start with Video
              </button>
              <button
                onClick={() => onChooseImage("text-to-image")}
                className="rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                Start with Image
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-white/55">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                OVA 80s style
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                cinematic motion
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                reference consistency
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                workflow UI
              </span>
            </div>
          </div>

          <div className="min-w-0 self-end">
            <AILoadingPreview />
          </div>
        </div>
      </div>

      <RecentCreationsStrip />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-3xl border border-white/10 bg-black/18 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-wide text-white/45">
                AI VIDEO CREATION
              </div>
              <div className="mt-1 text-lg font-semibold">Video tools</div>
            </div>
            <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
              reference / image / text
            </div>
          </div>

          <div className="space-y-4">
            {VIDEO_TOOLS.map((t) => (
              <TiltCard key={t.key} className="overflow-hidden rounded-2xl" glare={false}>
                <button
                  onClick={() => onChooseVideo(t.key)}
                  className="group block w-full rounded-2xl border border-white/10 bg-black/22 p-5 text-left transition hover:border-white/25 hover:bg-white/[0.04]"
                >
                  <div className="text-lg font-semibold">{t.label}</div>
                  <div className="mt-2 text-sm text-white/60">{t.description}</div>
                  <div className="mt-4 text-xs text-white/40 group-hover:text-white/75">
                    Launch →
                  </div>
                </button>
              </TiltCard>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-3xl border border-white/10 bg-black/18 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-wide text-white/45">
                AI IMAGE CREATION
              </div>
              <div className="mt-1 text-lg font-semibold">Image tools</div>
            </div>
            <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
              reference / text
            </div>
          </div>

          <div className="space-y-4">
            {IMAGE_TOOLS.map((t) => (
              <TiltCard key={t.key} className="overflow-hidden rounded-2xl" glare={false}>
                <button
                  onClick={() => onChooseImage(t.key)}
                  className="group block w-full rounded-2xl border border-white/10 bg-black/22 p-5 text-left transition hover:border-white/25 hover:bg-white/[0.04]"
                >
                  <div className="text-lg font-semibold">{t.label}</div>
                  <div className="mt-2 text-sm text-white/60">{t.description}</div>
                  <div className="mt-4 text-xs text-white/40 group-hover:text-white/75">
                    Launch →
                  </div>
                </button>
              </TiltCard>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/14 p-4 text-sm text-white/60 backdrop-blur-xl">
        This is the creation home. Image tools and video tools are separated into their own workspaces (like Vidu).
      </div>
    </div>
  );
}

export default function ToolsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    async function loadUserAndCredits() {
      setMounted(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsAuthed(!!user);

      if (!user) {
        setUserEmail(null);
        setCredits(null);
        return;
      }

      setUserEmail(user.email ?? null);

      const { data, error } = await supabase
        .from("credit_wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (!error && data) {
        setCredits(data.balance);
      } else {
        setCredits(0);
      }
    }

    void loadUserAndCredits();
  }, [supabase]);

  const logout = async () => {
    await supabase.auth.signOut();
    setIsAuthed(false);
    setUserEmail(null);
    setCredits(null);
    router.replace("/tools");
  };

  const goVideo = (tool: VideoToolKey) => {
    const target = `/create/video?tab=${tool}`;
    if (mounted && isAuthed) router.push(target);
    else router.push(`/login?redirect=${encodeURIComponent(target)}`);
  };

  const goImage = (tool: ImageToolKey) => {
    const target = `/create/image?tab=${tool}`;
    if (mounted && isAuthed) router.push(target);
    else router.push(`/login?redirect=${encodeURIComponent(target)}`);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white">
      <style>{`
        .marquee {
          width: max-content;
          animation: ko-marquee 22s linear infinite;
        }

        @keyframes ko-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

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

      <WallpaperRevealBackground src="/wallpaper.jpg" radius={240} />

      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] bg-transparent">
        <aside className="w-[270px] shrink-0 self-start rounded-r-2xl border-r border-white/10 bg-black/18 px-4 py-5 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              KOANimation
            </Link>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
              Tools
            </span>
          </div>

          <div className="mt-6 space-y-2">
            <button
              onClick={() => router.push("/tools")}
              className="w-full rounded-2xl border border-white/25 bg-white/10 px-3 py-3 text-left transition"
            >
              <div className="text-sm font-semibold">Home</div>
              <div className="mt-1 text-xs text-white/60">
                Choose a creation mode to begin.
              </div>
            </button>

            <div className="mt-4 text-[11px] font-semibold tracking-wide text-white/45">
              AI VIDEO
            </div>
            {VIDEO_TOOLS.map((item) => (
              <button
                key={item.key}
                onClick={() => goVideo(item.key)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="mt-1 text-xs text-white/60">
                  {item.description}
                </div>
              </button>
            ))}

            <div className="mt-4 text-[11px] font-semibold tracking-wide text-white/45">
              AI IMAGE
            </div>
            {IMAGE_TOOLS.map((item) => (
              <button
                key={item.key}
                onClick={() => goImage(item.key)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="mt-1 text-xs text-white/60">
                  {item.description}
                </div>
              </button>
            ))}

            {mounted && isAuthed && (
              <button
                onClick={() => void logout()}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]"
              >
                Log out
              </button>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/16 p-3 text-xs text-white/60 backdrop-blur-xl">
            Click a tool to launch its workspace.
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-white/60">Create</div>
              <h1 className="mt-1 text-2xl font-semibold">Creation Home</h1>
              <div className="mt-2 text-sm text-white/70">
                Logged in as: {userEmail ?? "Not logged in"}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80">
                ⚡ Credits: {credits ?? "..."}
              </div>
              <button className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]">
                History
              </button>
              <button className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]">
                Settings
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/12 p-5 backdrop-blur-xl">
            <ToolsHome onChooseVideo={goVideo} onChooseImage={goImage} />
          </div>
        </main>
      </div>
    </div>
  );
}