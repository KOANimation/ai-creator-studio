"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { useAuth } from "@/app/components/providers/AuthProvider";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  Clapperboard,
  Coins,
  Crown,
  Download,
  Gift,
  Home,
  ImageIcon,
  Layers3,
  LoaderCircle,
  LogOut,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Wand2,
  X,
} from "lucide-react";
import TopupButtons from "@/app/components/TopupButtons";

type VideoToolKey = "reference-to-video" | "image-to-video" | "text-to-video";

type GenerationKind =
  | "reference-to-video"
  | "image-to-video"
  | "start-end-to-video"
  | "text-to-video";

type VideoProvider = "vidu" | "kling";
type ReferenceInputMode = "images" | "subjects";

type KlingShotType = "intelligence" | "customize";
type KlingMode = "std" | "pro";

type KlingCustomShot = {
  id: string;
  prompt: string;
  duration: number;
};

type SavedGenerationStatus =
  | "uploading"
  | "created"
  | "queueing"
  | "processing"
  | "success"
  | "failed";

type RefundStatus = "none" | "pending" | "refunded";

type SavedGeneration = {
  id: string;
  kind: GenerationKind;
  taskId: string;
  prompt: string;
  provider: VideoProvider;
  model: string;
  duration: number;
  resolution: string;
  aspect: string;
  createdAt: string;
  status: SavedGenerationStatus;
  videoUrl: string | null;
  coverUrl: string | null;
  error: string | null;
  chargedCredits: number;
  refundStatus: RefundStatus;

  klingMultiShot?: boolean;
  klingShotType?: KlingShotType;
  klingWithAudio?: boolean;
};

type SubjectReference = {
  id: string;
  name: string;
  files: File[];
};

const VIDEO_TOOLS: { key: VideoToolKey; label: string }[] = [
  { key: "reference-to-video", label: "Reference to Video" },
  { key: "image-to-video", label: "Image to Video" },
  { key: "text-to-video", label: "Text to Video" },
];

const VIDEO_PROVIDERS: Array<{
  value: VideoProvider;
  label: string;
  meta: string;
}> = [
  { value: "vidu", label: "Vidu AI", meta: "cinematic video generation" },
  { value: "kling", label: "Kling AI", meta: "kling-v3 image-to-video" },
];

const ALL_DURATION_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 1);
const ALL_ASPECT_OPTIONS = ["16:9", "9:16", "1:1", "3:4", "4:3"];
const GENERATIONS_STORAGE_KEY = "koa_video_generations_v1";

const KLING_ALLOWED_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const KLING_ALLOWED_ASPECTS = ["16:9", "9:16", "1:1"];
const KLING_ALLOWED_RESOLUTIONS = ["720p"];

const PROMPT_PRESETS = [
  "cinematic camera movement, moody lighting, dramatic atmosphere",
  "old anime OVA look, rich cel shading, dynamic action framing",
  "slow push-in camera, subtle motion, emotional close-up",
  "stormy environment, rain, lightning flashes, epic tension",
  "high-energy action shot, fast motion, impact frames, stylized debris",
  "soft dreamy lighting, elegant motion, premium editorial feel",
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function createKlingCustomShot(duration = 1): KlingCustomShot {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    prompt: "",
    duration,
  };
}

function formatViduModelName(model: string) {
  switch (model) {
    case "viduq3-turbo":
      return "Vidu Q3 Turbo";
    case "viduq3-pro":
      return "Vidu Q3 Pro";
    case "viduq2-pro-fast":
      return "Vidu Q2 Pro Fast";
    case "viduq2-pro":
      return "Vidu Q2 Pro";
    case "viduq2-turbo":
      return "Vidu Q2 Turbo";
    case "viduq2":
      return "Vidu Q2";
    case "viduq1":
      return "Vidu Q1";
    case "vidu2.0":
      return "Vidu 2.0";
    case "kling-v3":
      return "Kling v3";
    default:
      return model;
  }
}

function formatProviderName(provider: VideoProvider) {
  if (provider === "vidu") return "Vidu AI";
  if (provider === "kling") return "Kling AI";
  return provider;
}

function getModelMeta(model: string, kind: GenerationKind) {
  if (model === "kling-v3") return "kling image-to-video";
  if (model === "viduq3-pro") return "highest quality";
  if (model === "viduq3-turbo") return "fast + premium";
  if (model === "viduq2-pro-fast") return "faster pro";
  if (model === "viduq2-pro") return "balanced pro";
  if (model === "viduq2-turbo") return "fastest";
  if (model === "viduq2") return "balanced";
  return kind.replaceAll("-", " ");
}

function getVideoGenerationCost({
  provider,
  kind,
  model,
  duration,
  resolution,
  amount,
  refImageCount,
  subjectImageCount,
  klingMultiShot,
}: {
  provider: VideoProvider;
  kind: GenerationKind;
  model: string;
  duration: number;
  resolution: string;
  amount: number;
  refImageCount: number;
  subjectImageCount: number;
  klingMultiShot?: boolean;
}) {
  let baseCost = 0;

  if (provider === "kling") {
    if (kind === "image-to-video") {
      baseCost = klingMultiShot ? 30 : 24;
    } else if (kind === "start-end-to-video") {
      baseCost = 28;
    } else {
      baseCost = 24;
    }

    let durationExtra = 0;
    if (duration >= 5) durationExtra += (duration - 4) * 3;
    if (duration >= 10) durationExtra += 4;
    if (duration >= 13) durationExtra += 6;

    return (baseCost + durationExtra) * amount;
  }

  if (kind === "reference-to-video") {
    switch (model) {
      case "viduq2-pro":
        baseCost = 28;
        break;
      case "viduq2":
        baseCost = 22;
        break;
      case "viduq1":
        baseCost = 18;
        break;
      case "vidu2.0":
        baseCost = 16;
        break;
      default:
        baseCost = 22;
        break;
    }
  }

  if (kind === "image-to-video") {
    switch (model) {
      case "viduq3-pro":
        baseCost = 30;
        break;
      case "viduq3-turbo":
        baseCost = 24;
        break;
      case "viduq2-pro-fast":
        baseCost = 22;
        break;
      case "viduq2-pro":
        baseCost = 24;
        break;
      case "viduq2-turbo":
        baseCost = 20;
        break;
      default:
        baseCost = 20;
        break;
    }
  }

  if (kind === "start-end-to-video") {
    switch (model) {
      case "viduq3-pro":
        baseCost = 34;
        break;
      case "viduq3-turbo":
        baseCost = 28;
        break;
      case "viduq2-pro-fast":
        baseCost = 26;
        break;
      case "viduq2-pro":
        baseCost = 28;
        break;
      case "viduq2-turbo":
        baseCost = 24;
        break;
      default:
        baseCost = 24;
        break;
    }
  }

  if (kind === "text-to-video") {
    switch (model) {
      case "viduq3-pro":
        baseCost = 26;
        break;
      case "viduq3-turbo":
        baseCost = 20;
        break;
      case "viduq2":
        baseCost = 18;
        break;
      default:
        baseCost = 18;
        break;
    }
  }

  let durationExtra = 0;
  if (duration >= 2) durationExtra += (duration - 1) * 3;
  if (duration >= 8) durationExtra += 4;
  if (duration >= 12) durationExtra += 6;

  let resolutionExtra = 0;
  if (resolution === "720p") resolutionExtra = 4;
  if (resolution === "1080p") resolutionExtra = 10;

  let referenceExtra = 0;
  if (kind === "reference-to-video") {
    const totalRefImages = refImageCount + subjectImageCount;
    referenceExtra += Math.max(0, totalRefImages - 1) * 2;
  }

  const perVideoCost = baseCost + durationExtra + resolutionExtra + referenceExtra;
  return perVideoCost * amount;
}

function getProviderOptions(active: VideoToolKey) {
  if (active === "image-to-video") {
    return VIDEO_PROVIDERS;
  }

  return VIDEO_PROVIDERS.filter((provider) => provider.value === "vidu");
}

function isKlingAvailableForTool(active: VideoToolKey) {
  return active === "image-to-video";
}

function WallpaperRevealBackground({
  src = "/wallpaper.jpg",
  radius = 260,
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
        rgba(0,0,0,0.97) 100%)`
    : `rgba(0,0,0,0.93)`;

  return (
    <>
      <div className="fixed inset-0 -z-30">
        <img
          src={src}
          alt="Wallpaper"
          className="h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/25" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-20">
        <div className="absolute inset-0" style={{ background: spotlight }} />
        <div className="absolute -left-24 top-24 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-[130px]" />
        <div className="absolute right-[-80px] top-[20%] h-[360px] w-[360px] rounded-full bg-fuchsia-500/10 blur-[130px]" />
        <div className="absolute bottom-[-120px] left-[20%] h-[340px] w-[340px] rounded-full bg-sky-500/8 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0.48)_40%,rgba(0,0,0,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.42)_30%,rgba(0,0,0,0.80)_100%)]" />
      </div>

      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.08]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='white' fill-opacity='1'%3E%3Ccircle cx='8' cy='8' r='1'/%3E%3Ccircle cx='64' cy='42' r='1'/%3E%3Ccircle cx='112' cy='20' r='1'/%3E%3Ccircle cx='38' cy='92' r='1'/%3E%3Ccircle cx='84' cy='116' r='1'/%3E%3Ccircle cx='132' cy='96' r='1'/%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />
    </>
  );
}

function SectionTitle({
  icon,
  children,
  kicker,
}: {
  icon?: ReactNode;
  children: ReactNode;
  kicker?: string;
}) {
  return (
    <div>
      {kicker ? (
        <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-white/38">
          {kicker}
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-sm font-semibold text-white/92">
        {icon ? <span className="text-white/60">{icon}</span> : null}
        <span>{children}</span>
      </div>
    </div>
  );
}

function GlassPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))] shadow-[0_20px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

function TopbarButton({
  href,
  onClick,
  icon,
  children,
  highlighted = false,
}: {
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  highlighted?: boolean;
}) {
  const className = cn(
    "inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition backdrop-blur-xl",
    highlighted
      ? "border-violet-300/20 bg-violet-400/10 text-violet-100 shadow-[0_10px_30px_rgba(139,92,246,0.14)] hover:border-violet-200/30 hover:bg-violet-400/15"
      : "border-white/10 bg-white/[0.04] text-white/80 hover:border-white/20 hover:bg-white/[0.07]"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        <span>{children}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

function CreditsPill({
  credits,
  loading,
}: {
  credits: number | null;
  loading: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -1, scale: 1.01 }}
      transition={{ duration: 0.18 }}
      className="relative overflow-hidden rounded-2xl border border-amber-300/20 bg-[linear-gradient(180deg,rgba(255,224,138,0.14),rgba(255,196,77,0.06))] px-4 py-2.5 shadow-[0_14px_38px_rgba(255,196,77,0.10)] backdrop-blur-2xl"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,246,212,0.18),transparent_42%)]" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-100/10 text-amber-200">
          <Coins size={18} />
        </div>
        <div className="leading-tight">
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-100/60">
            Credits
          </div>
          <div className="mt-0.5 text-sm font-semibold text-amber-50">
            {loading ? "Loading..." : credits == null ? "—" : credits.toLocaleString()}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ToolTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative cursor-pointer rounded-2xl px-4 py-2.5 text-sm font-medium transition",
        active ? "text-white" : "text-white/68 hover:text-white/88"
      )}
    >
      {active && (
        <motion.div
          layoutId="video-tab-pill-premium"
          className="absolute inset-0 rounded-2xl border border-white/20 bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

function MiniTab({
  label,
  active,
  onClick,
  disabled = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative cursor-pointer rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        active ? "text-white" : "text-white/68 hover:text-white/88"
      )}
    >
      {active && (
        <motion.div
          layoutId={`mini-tab-${label}`}
          className="absolute inset-0 rounded-2xl border border-white/20 bg-white/[0.09]"
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

function ChipSelector({
  value,
  onChange,
  options,
}: {
  value: string | number;
  onChange: (next: string) => void;
  options: Array<{ value: string; label?: string; meta?: string }>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {options.map((option) => {
        const isActive = String(value) === option.value;
        return (
          <motion.button
            key={option.value}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(option.value)}
            className={cn(
              "cursor-pointer rounded-2xl border px-3 py-3 text-left transition",
              isActive
                ? "border-violet-300/25 bg-violet-400/12 text-white shadow-[0_10px_24px_rgba(139,92,246,0.12)]"
                : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:bg-black/10"
            )}
          >
            <div className="text-sm font-medium">{option.label ?? option.value}</div>
            {option.meta ? (
              <div className="mt-1 text-[11px] text-white/45">{option.meta}</div>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}

function ProviderCardSelector({
  value,
  options,
  onChange,
}: {
  value: VideoProvider;
  options: Array<{ value: VideoProvider; label: string; meta: string }>;
  onChange: (next: VideoProvider) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <motion.button
            key={option.value}
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={() => onChange(option.value)}
            className={cn(
              "cursor-pointer rounded-2xl border p-3 text-left transition",
              active
                ? "border-violet-300/25 bg-violet-400/12 shadow-[0_10px_24px_rgba(139,92,246,0.12)]"
                : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/10"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white/92">{option.label}</div>
              {active ? (
                <div className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-violet-100">
                  Selected
                </div>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-white/48">{option.meta}</div>
          </motion.button>
        );
      })}
    </div>
  );
}

function ModelCardSelector({
  value,
  options,
  onChange,
  kind,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  kind: GenerationKind;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const active = option === value;
        return (
          <motion.button
            key={option}
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={() => onChange(option)}
            className={cn(
              "cursor-pointer rounded-2xl border p-3 text-left transition",
              active
                ? "border-violet-300/25 bg-violet-400/12 shadow-[0_10px_24px_rgba(139,92,246,0.12)]"
                : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/10"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white/92">
                {formatViduModelName(option)}
              </div>
              {active ? (
                <div className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-violet-100">
                  Selected
                </div>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-white/48">{getModelMeta(option, kind)}</div>
          </motion.button>
        );
      })}
    </div>
  );
}

function UploadRow({
  title,
  subtitle,
  accept,
  multiple,
  files,
  maxFiles,
  onAddFiles,
}: {
  title: string;
  subtitle: string;
  accept: string;
  multiple: boolean;
  files: File[];
  maxFiles: number;
  onAddFiles: (newFiles: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pick = () => inputRef.current?.click();

  const removeAt = (idx: number) => {
    onAddFiles(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/22 p-4">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          if (!list.length) return;
          const next = multiple ? [...files, ...list].slice(0, maxFiles) : [list[0]];
          onAddFiles(next);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white/92">{title}</div>
          <div className="mt-1 text-xs text-white/50">{subtitle}</div>
        </div>

        <button
          type="button"
          onClick={pick}
          disabled={files.length >= maxFiles}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          title="Add"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="mt-4 flex min-h-[64px] flex-wrap gap-2">
        {files.length === 0 ? (
          <div className="flex w-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-xs text-white/38">
            No files added yet.
          </div>
        ) : (
          files.slice(0, maxFiles).map((f, i) => {
            const url = URL.createObjectURL(f);
            const isVideo = f.type.startsWith("video/");
            const isImage = f.type.startsWith("image/");

            return (
              <div
                key={`${f.name}-${f.size}-${i}`}
                className="group relative h-16 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/30"
              >
                {isImage ? (
                  <img
                    src={url}
                    alt={f.name}
                    className="h-full w-full object-cover"
                    onLoad={() => URL.revokeObjectURL(url)}
                    draggable={false}
                  />
                ) : isVideo ? (
                  <video
                    className="h-full w-full object-cover"
                    src={url}
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedData={() => URL.revokeObjectURL(url)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-white/60">
                    FILE
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/70 text-white/80 opacity-0 backdrop-blur transition hover:bg-black/85 group-hover:opacity-100"
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-white/38">
        <span>
          {files.length}/{maxFiles} files
        </span>
      </div>
    </div>
  );
}

function FrameSlot({
  index,
  label,
  previewUrl,
  onPick,
  onClear,
}: {
  index: number;
  label: string;
  previewUrl: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  const has = !!previewUrl;

  return (
    <div className="relative flex-1">
      <div className="absolute left-3 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-black/60 text-xs font-semibold text-white/85 backdrop-blur">
        {index}
      </div>

      <div
        className={cn(
          "group relative overflow-hidden rounded-2xl border bg-black/25",
          has ? "border-white/10" : "border-white/15 border-dashed"
        )}
      >
        {has ? (
          <img
            src={previewUrl}
            alt={label}
            className="h-[150px] w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-[150px] w-full flex-col items-center justify-center">
            <button
              type="button"
              onClick={onPick}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-black/55 text-white/85 backdrop-blur hover:border-white/20 hover:bg-black/65"
              title="Upload"
            >
              <Upload size={16} />
            </button>

            <div className="mt-3 text-xs text-white/55">{label}</div>
          </div>
        )}

        {has && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-75" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPick}
                  className="cursor-pointer rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur hover:border-white/20 hover:bg-black/65"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  className="cursor-pointer rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-semibold text-white/75 backdrop-blur hover:border-white/20 hover:bg-black/65 hover:text-white/85"
                >
                  Remove
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 text-[11px] text-white/35">
        {index === 1 ? "Frame 1 (Start)" : "Frame 2 (End)"}
      </div>
    </div>
  );
}

function SubjectCard({
  subject,
  onChangeName,
  onAddFiles,
  onRemoveFile,
  onRemoveSubject,
}: {
  subject: SubjectReference;
  onChangeName: (value: string) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onRemoveSubject: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/22 p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          onAddFiles(files);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/92">Named Subject</div>
          <div className="mt-1 text-xs text-white/50">
            Add a short subject name and up to 3 images
          </div>
        </div>

        <button
          type="button"
          onClick={onRemoveSubject}
          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:bg-white/[0.08]"
          title="Remove subject"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-sm text-white/70">Subject name</div>
        <input
          value={subject.name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="hero, girl, spiderman, arthur..."
          className="w-full rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
        />
        <div className="mt-2 text-[11px] text-white/38">
          Use this in your prompt like <span className="text-white/60">@{subject.name || "hero"}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-white/70">Subject images</div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subject.files.length >= 3}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="mt-3 flex min-h-[64px] flex-wrap gap-2">
        {subject.files.length === 0 ? (
          <div className="flex w-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-xs text-white/38">
            No subject images added yet.
          </div>
        ) : (
          subject.files.map((file, index) => {
            const url = URL.createObjectURL(file);
            return (
              <div
                key={`${subject.id}-${file.name}-${file.size}-${index}`}
                className="group relative h-20 w-24 overflow-hidden rounded-2xl border border-white/10 bg-black/30"
              >
                <img
                  src={url}
                  alt={file.name}
                  className="h-full w-full object-cover"
                  onLoad={() => URL.revokeObjectURL(url)}
                  draggable={false}
                />
                <button
                  type="button"
                  onClick={() => onRemoveFile(index)}
                  className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-black/70 text-white/80 opacity-0 transition hover:bg-black/85 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 text-[11px] text-white/38">
        {subject.files.length}/3 images
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/38">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-sm font-semibold",
          danger ? "text-red-300" : "text-white"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function parseJsonSafely(raw: string) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function prettyStatus(status: SavedGenerationStatus | null) {
  switch (status) {
    case "uploading":
      return "Uploading references";
    case "created":
      return "Job created";
    case "queueing":
      return "Queued";
    case "processing":
      return "Generating video";
    case "success":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Preparing";
  }
}

function kindLabel(kind: GenerationKind) {
  switch (kind) {
    case "reference-to-video":
      return "Reference to Video";
    case "image-to-video":
      return "Image to Video";
    case "start-end-to-video":
      return "Start-End to Video";
    case "text-to-video":
      return "Text to Video";
    default:
      return "Video";
  }
}

function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read image dimensions."));
    };

    img.src = url;
  });
}

function getCurrentKind(
  active: VideoToolKey,
  endFrame: File | null
): GenerationKind {
  if (active === "reference-to-video") return "reference-to-video";
  if (active === "text-to-video") return "text-to-video";
  return endFrame ? "start-end-to-video" : "image-to-video";
}

function getModelOptions(provider: VideoProvider, kind: GenerationKind): string[] {
  if (provider === "kling") {
    if (kind === "image-to-video" || kind === "start-end-to-video") {
      return ["kling-v3"];
    }
    return [];
  }

  if (provider === "vidu") {
    switch (kind) {
      case "reference-to-video":
        return ["viduq2-pro", "viduq2"];
      case "image-to-video":
        return [
          "viduq3-turbo",
          "viduq3-pro",
          "viduq2-pro-fast",
          "viduq2-pro",
          "viduq2-turbo",
        ];
      case "start-end-to-video":
        return [
          "viduq3-turbo",
          "viduq3-pro",
          "viduq2-pro-fast",
          "viduq2-pro",
          "viduq2-turbo",
        ];
      case "text-to-video":
        return ["viduq3-turbo", "viduq3-pro", "viduq2"];
      default:
        return ["viduq2-pro"];
    }
  }

  return ["viduq2-pro"];
}

function getAllowedDurations(
  provider: VideoProvider,
  kind: GenerationKind,
  model: string
): number[] {
  if (provider === "kling") {
    if (kind === "image-to-video" || kind === "start-end-to-video") {
      return KLING_ALLOWED_DURATIONS;
    }
    return [5];
  }

  if (kind === "reference-to-video") {
    if (model === "viduq2-pro") return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (model === "viduq2") return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    return [5];
  }

  if (kind === "image-to-video") {
    if (model === "viduq3-pro" || model === "viduq3-turbo") return ALL_DURATION_OPTIONS;
    if (
      model === "viduq2-pro" ||
      model === "viduq2-pro-fast" ||
      model === "viduq2-turbo"
    ) {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    }
    return [5];
  }

  if (kind === "start-end-to-video") {
    if (model === "viduq3-pro" || model === "viduq3-turbo") return ALL_DURATION_OPTIONS;
    if (
      model === "viduq2-pro" ||
      model === "viduq2-pro-fast" ||
      model === "viduq2-turbo"
    ) {
      return [1, 2, 3, 4, 5, 6, 7, 8];
    }
    return [5];
  }

  if (kind === "text-to-video") {
    if (model === "viduq3-pro" || model === "viduq3-turbo") return ALL_DURATION_OPTIONS;
    if (model === "viduq2") return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    return [5];
  }

  return [5];
}

function getAllowedResolutions(
  provider: VideoProvider,
  kind: GenerationKind,
  model: string,
  duration: number
): string[] {
  if (provider === "kling") {
    if (kind === "image-to-video" || kind === "start-end-to-video") {
      return KLING_ALLOWED_RESOLUTIONS;
    }
    return ["720p"];
  }

  if (kind === "reference-to-video") {
    if (model === "viduq2-pro" || model === "viduq2") {
      return ["540p", "720p", "1080p"];
    }
    return ["720p"];
  }

  if (kind === "image-to-video") {
    if (model === "viduq3-pro" || model === "viduq3-turbo") {
      return ["540p", "720p", "1080p"];
    }
    if (
      model === "viduq2-pro" ||
      model === "viduq2-pro-fast" ||
      model === "viduq2-turbo"
    ) {
      return ["720p", "1080p"];
    }
    return ["720p"];
  }

  if (kind === "start-end-to-video") {
    if (model === "viduq3-pro" || model === "viduq3-turbo") {
      return ["540p", "720p", "1080p"];
    }
    if (
      model === "viduq2-pro" ||
      model === "viduq2-pro-fast" ||
      model === "viduq2-turbo"
    ) {
      return ["540p", "720p", "1080p"];
    }
    return ["720p"];
  }

  if (kind === "text-to-video") {
    if (model === "viduq3-pro" || model === "viduq3-turbo") {
      return ["540p", "720p", "1080p"];
    }
    if (model === "viduq2") return ["540p", "720p", "1080p"];
    return ["720p"];
  }

  return ["720p"];
}

function getAllowedAspects(provider: VideoProvider, active: VideoToolKey) {
  if (provider === "kling" && active === "image-to-video") {
    return KLING_ALLOWED_ASPECTS;
  }

  return ALL_ASPECT_OPTIONS;
}

function getStatusBadgeClasses(status: SavedGenerationStatus) {
  if (status === "success") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }
  if (status === "failed") {
    return "border-red-400/20 bg-red-400/10 text-red-200";
  }
  return "border-white/10 bg-black/40 text-white/70";
}

function getTimelineSteps(status: SavedGenerationStatus | null) {
  const statuses: SavedGenerationStatus[] = [
    "created",
    "queueing",
    "processing",
    "success",
  ];

  const currentIndex =
    status === "failed"
      ? 2
      : Math.max(0, statuses.findIndex((s) => s === status));

  return [
    {
      label: "Created",
      active: currentIndex >= 0 || status === "uploading",
      done: status !== "uploading",
    },
    {
      label: "Queued",
      active: currentIndex >= 1,
      done: currentIndex > 1 || status === "success",
    },
    {
      label: "Rendering",
      active: currentIndex >= 2 || status === "processing" || status === "failed",
      done: status === "success",
    },
    {
      label: "Ready",
      active: status === "success",
      done: status === "success",
    },
  ];
}

function normalizeGeneration(item: Partial<SavedGeneration>): SavedGeneration {
  return {
    id:
      item.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`),
    kind: (item.kind as GenerationKind) ?? "text-to-video",
    taskId: item.taskId ?? "",
    prompt: item.prompt ?? "",
    provider: (item.provider as VideoProvider) ?? "vidu",
    model: item.model ?? "",
    duration: typeof item.duration === "number" ? item.duration : 5,
    resolution: item.resolution ?? "720p",
    aspect: item.aspect ?? "16:9",
    createdAt: item.createdAt ?? new Date().toISOString(),
    status: (item.status as SavedGenerationStatus) ?? "created",
    videoUrl: item.videoUrl ?? null,
    coverUrl: item.coverUrl ?? null,
    error: item.error ?? null,
    chargedCredits: typeof item.chargedCredits === "number" ? item.chargedCredits : 0,
    refundStatus:
      item.refundStatus === "pending" ||
      item.refundStatus === "refunded" ||
      item.refundStatus === "none"
        ? item.refundStatus
        : "none",
    klingMultiShot: item.klingMultiShot ?? false,
    klingShotType:
      item.klingShotType === "intelligence" || item.klingShotType === "customize"
        ? item.klingShotType
        : undefined,
    klingWithAudio: item.klingWithAudio ?? false,
  };
}

function buildTaskRefundReferenceKey(taskId: string) {
  return `video-task-refund:${taskId}`;
}

function buildBatchRefundReferenceKey(batchKey: string) {
  return `video-batch-refund:${batchKey}`;
}

function VideoHistoryCard({
  item,
  onOpen,
}: {
  item: SavedGeneration;
  onOpen: (item: SavedGeneration) => void;
}) {
  return (
    <motion.button
      type="button"
      layout
      onClick={() => onOpen(item)}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      className="group block w-full cursor-pointer overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.03] text-left hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="relative overflow-hidden bg-black">
        {item.videoUrl ? (
          <video
            className="h-[320px] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            src={item.videoUrl}
            poster={item.coverUrl ?? undefined}
            muted
            playsInline
            preload="metadata"
          />
        ) : item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={item.prompt}
            className="h-[320px] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            draggable={false}
          />
        ) : (
          <div className="flex h-[320px] w-full items-center justify-center bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
            {item.status === "failed" ? (
              <div className="px-6 text-center text-sm text-red-200/90">
                Generation failed
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-10 w-10">
                  <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-white/80" />
                </div>
                <div className="text-sm text-white/70">{prettyStatus(item.status)}</div>
              </div>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/16 to-transparent" />

        <div className="absolute left-3 top-3">
          <div
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur",
              getStatusBadgeClasses(item.status)
            )}
          >
            {prettyStatus(item.status)}
          </div>
        </div>

        <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[11px] text-white/70 backdrop-blur">
          <div className="flex items-center gap-1.5">
            <Play size={11} />
            Video
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="line-clamp-2 text-sm font-medium leading-5 text-white">
            {item.prompt || "Untitled generation"}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/65">
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {formatViduModelName(item.model)}
            </div>
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {item.duration}s
            </div>
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {item.aspect}
            </div>
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {formatProviderName(item.provider)}
            </div>
            {item.provider === "kling" && item.klingMultiShot ? (
              <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
                multi-shot
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default function CreateVideoClient({
  initialCredits = 0,
}: {
  initialCredits?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const {
    user,
    loading: authLoading,
    credits: sharedCredits,
    refreshCredits,
    signOut,
  } = useAuth();

  const tabParam = (searchParams.get("tab") || "") as VideoToolKey | "";
  const [active, setActive] = useState<VideoToolKey>("reference-to-video");

  const [mounted, setMounted] = useState(false);
  const [showTopupPanel, setShowTopupPanel] = useState(false);

  const [provider, setProvider] = useState<VideoProvider>("vidu");
  const [referenceInputMode, setReferenceInputMode] =
    useState<ReferenceInputMode>("images");

  const [startFrame, setStartFrame] = useState<File | null>(null);
  const [endFrame, setEndFrame] = useState<File | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [endPreview, setEndPreview] = useState<string | null>(null);
  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);

  const [refImages, setRefImages] = useState<File[]>([]);
  const [subjects, setSubjects] = useState<SubjectReference[]>([]);

  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");

  const [model, setModel] = useState("viduq2-pro");
  const [resolution, setResolution] = useState("1080p");
  const [duration, setDuration] = useState<number>(5);
  const [amount, setAmount] = useState<number>(2);
  const [aspect, setAspect] = useState<string>("16:9");

  const [klingMode, setKlingMode] = useState<KlingMode>("std");
  const [klingMultiShot, setKlingMultiShot] = useState(false);
  const [klingShotType, setKlingShotType] = useState<KlingShotType>("intelligence");
  const [klingWithAudio, setKlingWithAudio] = useState(false);
  const [klingCustomShots, setKlingCustomShots] = useState<KlingCustomShot[]>([
    createKlingCustomShot(2),
    createKlingCustomShot(3),
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generations, setGenerations] = useState<SavedGeneration[]>([]);
  const [selectedGeneration, setSelectedGeneration] =
    useState<SavedGeneration | null>(null);
  const [hasLoadedGenerations, setHasLoadedGenerations] = useState(false);

  const [historyFilter, setHistoryFilter] = useState<
    "all" | "success" | "failed" | "processing"
  >("all");
  const [historySearch, setHistorySearch] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveCredits = useMemo(() => {
    if (typeof sharedCredits === "number") return sharedCredits;
    if (authLoading) return initialCredits;
    return null;
  }, [sharedCredits, authLoading, initialCredits]);

  const creditsAreResolved = typeof effectiveCredits === "number";

  const subjectImageCount = useMemo(
    () => subjects.reduce((sum, subject) => sum + subject.files.length, 0),
    [subjects]
  );

  const providerOptions = useMemo(() => getProviderOptions(active), [active]);
  const canUseSubjectMode =
    active === "reference-to-video" && provider === "vidu" && model !== "viduq2-pro";
  const klingAvailable = isKlingAvailableForTool(active);
  const isKling = provider === "kling";
  const klingMultiShotLockedByEndFrame =
    active === "image-to-video" && !!endFrame && isKling;

  useEffect(() => {
    if (!providerOptions.some((option) => option.value === provider)) {
      setProvider(providerOptions[0]?.value ?? "vidu");
    }
  }, [providerOptions, provider]);

  useEffect(() => {
    if (!canUseSubjectMode && referenceInputMode === "subjects") {
      setReferenceInputMode("images");
    }
  }, [canUseSubjectMode, referenceInputMode]);

  useEffect(() => {
    if (isKling && active !== "image-to-video") {
      setProvider("vidu");
    }
  }, [isKling, active]);

  useEffect(() => {
    if (!isKling) {
      setNegativePrompt("");
      setKlingMultiShot(false);
      setKlingShotType("intelligence");
      setKlingWithAudio(false);
      setKlingMode("std");
      setKlingCustomShots([createKlingCustomShot(2), createKlingCustomShot(3)]);
    }
  }, [isKling]);

  useEffect(() => {
    if (isKling && endFrame && klingMultiShot) {
      setKlingMultiShot(false);
      setKlingShotType("intelligence");
    }
  }, [isKling, endFrame, klingMultiShot]);

  const setStartFile = (f: File | null) => {
    setStartFrame(f);
    setStartPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  };

  const setEndFile = (f: File | null) => {
    setEndFrame(f);
    setEndPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  };

  useEffect(() => {
    return () => {
      if (startPreview) URL.revokeObjectURL(startPreview);
      if (endPreview) URL.revokeObjectURL(endPreview);
    };
  }, [startPreview, endPreview]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(GENERATIONS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<SavedGeneration>[];
      if (Array.isArray(parsed)) {
        const normalized = parsed.map((item) => normalizeGeneration(item));
        setGenerations(normalized);
        if (normalized.length > 0) {
          setSelectedGeneration(normalized[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load generations from localStorage:", err);
    } finally {
      setHasLoadedGenerations(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoadedGenerations) return;

    try {
      localStorage.setItem(GENERATIONS_STORAGE_KEY, JSON.stringify(generations));
    } catch (err) {
      console.error("Failed to save generations to localStorage:", err);
    }
  }, [generations, hasLoadedGenerations]);

  useEffect(() => {
    const isOnTool =
      tabParam === "reference-to-video" ||
      tabParam === "image-to-video" ||
      tabParam === "text-to-video";

    if (!isOnTool) return;
    if (!mounted) return;
    if (authLoading) return;
    if (user) return;

    const redirect = `/create/video?tab=${tabParam}`;
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [tabParam, user, router, mounted, authLoading]);

  useEffect(() => {
    if (
      tabParam === "reference-to-video" ||
      tabParam === "image-to-video" ||
      tabParam === "text-to-video"
    ) {
      setActive(tabParam);
    }
  }, [tabParam]);

  const toolLabel = useMemo(
    () => VIDEO_TOOLS.find((t) => t.key === active)?.label ?? "Create",
    [active]
  );

  const currentKind = useMemo(
    () => getCurrentKind(active, endFrame),
    [active, endFrame]
  );

  const modelOptions = useMemo(
    () => getModelOptions(provider, currentKind),
    [provider, currentKind]
  );

  const allowedDurations = useMemo(
    () => getAllowedDurations(provider, currentKind, model),
    [provider, currentKind, model]
  );

  const allowedResolutions = useMemo(
    () => getAllowedResolutions(provider, currentKind, model, duration),
    [provider, currentKind, model, duration]
  );

  const allowedAspects = useMemo(
    () => getAllowedAspects(provider, active),
    [provider, active]
  );

  useEffect(() => {
    if (!modelOptions.includes(model)) {
      setModel(modelOptions[0] ?? "viduq2-pro");
    }
  }, [modelOptions, model]);

  useEffect(() => {
    if (!allowedDurations.includes(duration)) {
      setDuration(allowedDurations[0]);
    }
  }, [allowedDurations, duration]);

  useEffect(() => {
    if (!allowedResolutions.includes(resolution)) {
      setResolution(allowedResolutions[0]);
    }
  }, [allowedResolutions, resolution]);

  useEffect(() => {
    if (!allowedAspects.includes(aspect)) {
      setAspect(allowedAspects[0]);
    }
  }, [allowedAspects, aspect]);

  useEffect(() => {
    if (!isKling) return;
    if (!klingMultiShot) return;

    if (klingShotType === "customize") {
      const total = klingCustomShots.reduce((sum, shot) => sum + shot.duration, 0);

      if (total === duration) return;

      setKlingCustomShots((prev) => {
        if (prev.length === 0) return [createKlingCustomShot(duration)];

        const next = [...prev];
        const diff = duration - total;
        const last = next[next.length - 1];
        const adjusted = Math.max(1, last.duration + diff);
        next[next.length - 1] = { ...last, duration: adjusted };

        const reTotal = next.reduce((sum, shot) => sum + shot.duration, 0);
        if (reTotal !== duration) {
          const finalDiff = duration - reTotal;
          next[next.length - 1] = {
            ...next[next.length - 1],
            duration: Math.max(1, next[next.length - 1].duration + finalDiff),
          };
        }

        return next;
      });
    }
  }, [isKling, klingMultiShot, klingShotType, klingCustomShots, duration]);

  const klingCustomDurationSum = useMemo(
    () => klingCustomShots.reduce((sum, shot) => sum + shot.duration, 0),
    [klingCustomShots]
  );

  const klingCustomShotsValid = useMemo(() => {
    if (!isKling || !klingMultiShot || klingShotType !== "customize") return true;
    if (klingCustomShots.length === 0 || klingCustomShots.length > 6) return false;
    if (klingCustomDurationSum !== duration) return false;

    return klingCustomShots.every(
      (shot) => shot.prompt.trim().length > 0 && Number.isInteger(shot.duration) && shot.duration >= 1
    );
  }, [
    isKling,
    klingMultiShot,
    klingShotType,
    klingCustomShots,
    klingCustomDurationSum,
    duration,
  ]);

  const videoCreditCost = useMemo(() => {
    return getVideoGenerationCost({
      provider,
      kind: currentKind,
      model,
      duration,
      resolution,
      amount,
      refImageCount: referenceInputMode === "images" ? refImages.length : 0,
      subjectImageCount: referenceInputMode === "subjects" ? subjectImageCount : 0,
      klingMultiShot,
    });
  }, [
    provider,
    currentKind,
    model,
    duration,
    resolution,
    amount,
    refImages.length,
    subjectImageCount,
    referenceInputMode,
    klingMultiShot,
  ]);

  const remainingCreditsAfterCreate =
    effectiveCredits != null ? effectiveCredits - videoCreditCost : null;

  const hasEnoughCredits =
    effectiveCredits != null && effectiveCredits >= videoCreditCost;

  useEffect(() => {
    if (creditsAreResolved && !hasEnoughCredits) {
      setShowTopupPanel(true);
    }
  }, [creditsAreResolved, hasEnoughCredits]);

  const deductCredits = async (
    amountValue: number,
    description: string,
    metadata: Record<string, unknown>
  ) => {
    if (!user) {
      throw new Error("You must be logged in.");
    }

    const { data, error } = await supabase.rpc("deduct_credits_safe", {
      p_user_id: user.id,
      p_amount: amountValue,
      p_description: description,
      p_metadata: metadata,
    });

    if (error) {
      throw new Error(error.message || "Failed to deduct credits.");
    }

    await refreshCredits();
    return data;
  };

  const refundCredits = async (
    amountValue: number,
    description: string,
    referenceKey: string,
    metadata: Record<string, unknown>
  ) => {
    if (!user) {
      throw new Error("You must be logged in.");
    }

    const { data, error } = await supabase.rpc("refund_credits_safe", {
      p_user_id: user.id,
      p_amount: amountValue,
      p_description: description,
      p_reference_key: referenceKey,
      p_metadata: metadata,
    });

    if (error) {
      throw new Error(error.message || "Failed to refund credits.");
    }

    await refreshCredits();
    return data;
  };

  const logout = async () => {
    await signOut();
    router.replace("/tools");
    router.refresh();
  };

  const goToolsHome = () => {
    router.push("/tools");
  };

  const goPricing = () => {
    router.push("/pricing");
  };

  const goImageWorkspace = () => {
    router.push("/create/image?tab=text-to-image");
  };

  const onChangeTool = (k: VideoToolKey) => router.push(`/create/video?tab=${k}`);

  const addSubject = () => {
    if (subjects.length >= 7) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    setSubjects((prev) => [...prev, { id, name: "", files: [] }]);
  };

  const updateSubject = (
    subjectId: string,
    updater: (subject: SubjectReference) => SubjectReference
  ) => {
    setSubjects((prev) =>
      prev.map((subject) => (subject.id === subjectId ? updater(subject) : subject))
    );
  };

  const removeSubject = (subjectId: string) => {
    setSubjects((prev) => prev.filter((subject) => subject.id !== subjectId));
  };

  const addKlingCustomShot = () => {
    setKlingCustomShots((prev) => {
      if (prev.length >= 6) return prev;
      return [...prev, createKlingCustomShot(1)];
    });
  };

  const updateKlingCustomShot = (
    shotId: string,
    updater: (shot: KlingCustomShot) => KlingCustomShot
  ) => {
    setKlingCustomShots((prev) =>
      prev.map((shot) => (shot.id === shotId ? updater(shot) : shot))
    );
  };

  const removeKlingCustomShot = (shotId: string) => {
    setKlingCustomShots((prev) => prev.filter((shot) => shot.id !== shotId));
  };

  const createReferenceToVideo = async () => {
    const batchKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    try {
      setError(null);
      setIsCreating(true);

      if (!user) {
        throw new Error("You must be logged in.");
      }

      if (effectiveCredits != null && effectiveCredits < videoCreditCost) {
        throw new Error(
          `You need ${videoCreditCost} credits, but only have ${effectiveCredits}.`
        );
      }

      if (!prompt.trim()) {
        throw new Error("Please enter a prompt.");
      }

      if (referenceInputMode === "images") {
        if (refImages.length === 0) {
          throw new Error("Upload at least 1 reference image.");
        }

        if (refImages.length > 7) {
          throw new Error("You can upload at most 7 reference images.");
        }
      }

      if (referenceInputMode === "subjects") {
        if (model === "viduq2-pro") {
          throw new Error("Vidu Q2 Pro currently supports image references only.");
        }

        if (subjects.length === 0) {
          throw new Error("Add at least 1 subject.");
        }

        if (subjects.length > 7) {
          throw new Error("You can add at most 7 subjects.");
        }

        const totalSubjectImages = subjects.reduce(
          (sum, subject) => sum + subject.files.length,
          0
        );

        if (totalSubjectImages === 0) {
          throw new Error("Add at least 1 subject image.");
        }

        if (totalSubjectImages > 7) {
          throw new Error("Subject mode supports at most 7 images total.");
        }

        for (const subject of subjects) {
          if (!subject.name.trim()) {
            throw new Error("Each subject must have a name.");
          }

          if (subject.files.length === 0) {
            throw new Error(`Subject "${subject.name || "Unnamed"}" must have at least 1 image.`);
          }

          if (subject.files.length > 3) {
            throw new Error(`Subject "${subject.name || "Unnamed"}" can have at most 3 images.`);
          }
        }
      }

      const perItemCredits = videoCreditCost / amount;

      await deductCredits(videoCreditCost, "Reference to video generation", {
        kind: "reference-to-video",
        provider,
        model,
        duration,
        resolution,
        aspect,
        amount,
        referenceInputMode,
        refImageCount: refImages.length,
        subjectCount: subjects.length,
        subjectImageCount,
        batchKey,
      });

      const requests = Array.from({ length: amount }, async () => {
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("model", model);
        formData.append("duration", String(duration));
        formData.append("resolution", resolution);
        formData.append("aspectRatio", aspect);

        if (referenceInputMode === "images") {
          refImages.forEach((file) => {
            formData.append("images", file);
          });
        } else {
          const lightweightSubjects = subjects.map((subject) => ({
            id: subject.id,
            name: subject.name.trim(),
          }));

          formData.append("subjects", JSON.stringify(lightweightSubjects));

          subjects.forEach((subject) => {
            subject.files.forEach((file) => {
              formData.append(`subjectImages:${subject.id}`, file);
            });
          });
        }

        const res = await fetch("/api/vidu/reference", {
          method: "POST",
          body: formData,
        });

        const raw = await res.text();
        const data = parseJsonSafely(raw);

        if (!res.ok) {
          throw new Error(
            (data as { details?: { message?: string }; error?: string } | null)
              ?.details?.message ||
              (data as { error?: string } | null)?.error ||
              raw ||
              "Failed to create task."
          );
        }

        const createdTaskId =
          (data as { task_id?: string } | null)?.task_id ?? "";
        const createdState =
          ((data as { state?: SavedGenerationStatus } | null)?.state ??
            "created") as SavedGenerationStatus;

        if (!createdTaskId) {
          throw new Error("Task created but no task id was returned.");
        }

        return { taskId: createdTaskId, state: createdState };
      });

      const results = await Promise.allSettled(requests);

      const successes = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );

      const failedCount = results.length - successes.length;

      if (failedCount > 0) {
        const refundAmount = perItemCredits * failedCount;
        try {
          await refundCredits(
            refundAmount,
            "Refund for failed reference-to-video batch items",
            buildBatchRefundReferenceKey(`${batchKey}:reference:${failedCount}`),
            {
              batchKey,
              kind: "reference-to-video",
              failedCount,
              amountRefunded: refundAmount,
              provider,
              model,
              duration,
              resolution,
              aspect,
            }
          );
        } catch (refundErr) {
          console.error("Reference batch refund failed:", refundErr);
        }
      }

      if (successes.length === 0) {
        throw new Error("No video tasks were created.");
      }

      const timestamp = new Date().toISOString();

      const newGenerations: SavedGeneration[] = successes.map((task, index) =>
        normalizeGeneration({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${index}-${Math.random()}`,
          kind: "reference-to-video",
          taskId: task.taskId,
          prompt,
          provider,
          model,
          duration,
          resolution,
          aspect,
          createdAt: timestamp,
          status: task.state,
          videoUrl: null,
          coverUrl: null,
          error: null,
          chargedCredits: perItemCredits,
          refundStatus: "none",
        })
      );

      setGenerations((prev) => [...newGenerations, ...prev]);
      setSelectedGeneration(newGenerations[0] ?? null);

      if (failedCount > 0) {
        setError(
          `${failedCount} generation${failedCount > 1 ? "s were" : " was"} not created and refunded automatically.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsCreating(false);
      await refreshCredits();
    }
  };

  const createKlingImageVideo = async () => {
    const batchKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    try {
      setError(null);
      setIsCreating(true);

      if (!user) {
        throw new Error("You must be logged in.");
      }

      if (effectiveCredits != null && effectiveCredits < videoCreditCost) {
        throw new Error(
          `You need ${videoCreditCost} credits, but only have ${effectiveCredits}.`
        );
      }

      if (!startFrame) {
        throw new Error("Please upload a start frame.");
      }

      if (!startFrame.type.startsWith("image/")) {
        throw new Error("Start frame must be an image.");
      }

      if (endFrame && !endFrame.type.startsWith("image/")) {
        throw new Error("End frame must be an image.");
      }

      if (startFrame.size > 10 * 1024 * 1024) {
        throw new Error("Kling start frame must be 10MB or smaller.");
      }

      if (endFrame && endFrame.size > 10 * 1024 * 1024) {
        throw new Error("Kling end frame must be 10MB or smaller.");
      }

      if (klingMultiShot && endFrame) {
        throw new Error("Multi-shot cannot be used when an end frame is provided.");
      }

      if (klingMultiShot) {
        if (klingShotType === "intelligence") {
          if (!prompt.trim()) {
            throw new Error("Please enter a prompt for Kling multi-shot auto mode.");
          }
        }

        if (klingShotType === "customize") {
          if (!klingCustomShotsValid) {
            throw new Error(
              "Custom shot builder is invalid. Each shot needs a prompt, and total shot duration must equal the selected duration."
            );
          }
        }
      } else {
        if (!prompt.trim()) {
          throw new Error("Please enter a prompt.");
        }
      }

      const mode: GenerationKind = endFrame ? "start-end-to-video" : "image-to-video";
      const perItemCredits = videoCreditCost / amount;

      await deductCredits(
        videoCreditCost,
        endFrame ? "Kling start-end video generation" : "Kling image to video generation",
        {
          kind: mode,
          provider: "kling",
          model: "kling-v3",
          duration,
          resolution,
          aspect,
          amount,
          klingMode,
          klingMultiShot,
          klingShotType: klingMultiShot ? klingShotType : null,
          klingWithAudio,
          batchKey,
        }
      );

      const requests = Array.from({ length: amount }, async () => {
        const formData = new FormData();
        formData.append("startFrame", startFrame);

        if (endFrame) {
          formData.append("endFrame", endFrame);
        }

        if (!klingMultiShot || klingShotType === "intelligence") {
          formData.append("prompt", prompt);
        }

        if (negativePrompt.trim()) {
          formData.append("negativePrompt", negativePrompt);
        }

        formData.append("duration", String(duration));
        formData.append("mode", klingMode);
        formData.append("withAudio", String(klingWithAudio));
        formData.append("multiShot", String(klingMultiShot));

        if (klingMultiShot) {
          formData.append("shotType", klingShotType);
        }

        if (klingMultiShot && klingShotType === "customize") {
          formData.append(
            "multiPrompt",
            JSON.stringify(
              klingCustomShots.map((shot, index) => ({
                index: index + 1,
                prompt: shot.prompt.trim(),
                duration: String(shot.duration),
              }))
            )
          );
        }

        const res = await fetch("/api/kling/image-to-video", {
          method: "POST",
          body: formData,
        });

        const raw = await res.text();
        const data = parseJsonSafely(raw);

        if (!res.ok) {
          throw new Error(
            (data as { details?: { message?: string }; error?: string } | null)
              ?.details?.message ||
              (data as { error?: string } | null)?.error ||
              raw ||
              "Failed to create Kling task."
          );
        }

        const createdTaskId =
          (data as { taskId?: string } | null)?.taskId ?? "";
        const apiStatus =
          (data as { status?: string } | null)?.status?.toLowerCase() ?? "submitted";

        let createdState: SavedGenerationStatus = "created";

        if (apiStatus.includes("queue")) createdState = "queueing";
        else if (apiStatus.includes("process")) createdState = "processing";
        else if (apiStatus.includes("success") || apiStatus.includes("succeed")) {
          createdState = "success";
        } else if (apiStatus.includes("fail")) {
          createdState = "failed";
        }

        if (!createdTaskId) {
          throw new Error("Kling task created but no task id was returned.");
        }

        return {
          taskId: createdTaskId,
          state: createdState,
          kind: mode,
        };
      });

      const results = await Promise.allSettled(requests);

      const successes = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );

      const failedCount = results.length - successes.length;

      if (failedCount > 0) {
        const refundAmount = perItemCredits * failedCount;
        try {
          await refundCredits(
            refundAmount,
            "Refund for failed Kling batch items",
            buildBatchRefundReferenceKey(`${batchKey}:${mode}:kling:${failedCount}`),
            {
              batchKey,
              kind: mode,
              failedCount,
              amountRefunded: refundAmount,
              provider: "kling",
              model: "kling-v3",
              duration,
              resolution,
              aspect,
              klingMultiShot,
              klingShotType: klingMultiShot ? klingShotType : null,
            }
          );
        } catch (refundErr) {
          console.error("Kling batch refund failed:", refundErr);
        }
      }

      if (successes.length === 0) {
        throw new Error("No Kling video tasks were created.");
      }

      const timestamp = new Date().toISOString();

      const newGenerations: SavedGeneration[] = successes.map((task, index) =>
        normalizeGeneration({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${index}-${Math.random()}`,
          kind: task.kind,
          taskId: task.taskId,
          prompt,
          provider: "kling",
          model: "kling-v3",
          duration,
          resolution,
          aspect,
          createdAt: timestamp,
          status: task.state,
          videoUrl: null,
          coverUrl: null,
          error: null,
          chargedCredits: perItemCredits,
          refundStatus: "none",
          klingMultiShot,
          klingShotType: klingMultiShot ? klingShotType : undefined,
          klingWithAudio,
        })
      );

      setGenerations((prev) => [...newGenerations, ...prev]);
      setSelectedGeneration(newGenerations[0] ?? null);

      if (failedCount > 0) {
        setError(
          `${failedCount} Kling generation${failedCount > 1 ? "s were" : " was"} not created and refunded automatically.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsCreating(false);
      await refreshCredits();
    }
  };

  const createImageOrStartEndVideo = async () => {
    if (provider === "kling") {
      await createKlingImageVideo();
      return;
    }

    const batchKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    try {
      setError(null);
      setIsCreating(true);

      if (!user) {
        throw new Error("You must be logged in.");
      }

      if (effectiveCredits != null && effectiveCredits < videoCreditCost) {
        throw new Error(
          `You need ${videoCreditCost} credits, but only have ${effectiveCredits}.`
        );
      }

      if (!startFrame) {
        throw new Error("Please upload a start frame.");
      }

      if (!prompt.trim()) {
        throw new Error("Please enter a prompt.");
      }

      if (!startFrame.type.startsWith("image/")) {
        throw new Error("Start frame must be an image.");
      }

      if (endFrame && !endFrame.type.startsWith("image/")) {
        throw new Error("End frame must be an image.");
      }

      let mode: GenerationKind = "image-to-video";
      let endpoint = "/api/vidu/image";

      if (endFrame) {
        const [startDims, endDims] = await Promise.all([
          getImageDimensions(startFrame),
          getImageDimensions(endFrame),
        ]);

        const startRatio = startDims.width / startDims.height;
        const endRatio = endDims.width / endDims.height;
        const ratioBetween = startRatio / endRatio;

        if (ratioBetween < 0.8 || ratioBetween > 1.25) {
          throw new Error(
            "Start and end frame aspect ratios are too different. Please use images with similar proportions."
          );
        }

        mode = "start-end-to-video";
        endpoint = "/api/vidu/start-end";
      }

      const perItemCredits = videoCreditCost / amount;

      await deductCredits(
        videoCreditCost,
        endFrame ? "Start-end video generation" : "Image to video generation",
        {
          kind: mode,
          provider,
          model,
          duration,
          resolution,
          aspect,
          amount,
          batchKey,
        }
      );

      const requests = Array.from({ length: amount }, async () => {
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("model", model);
        formData.append("duration", String(duration));
        formData.append("resolution", resolution);
        formData.append("aspectRatio", aspect);
        formData.append("startFrame", startFrame);

        if (endFrame) {
          formData.append("endFrame", endFrame);
        }

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        const raw = await res.text();
        const data = parseJsonSafely(raw);

        if (!res.ok) {
          throw new Error(
            (data as { details?: { message?: string }; error?: string } | null)
              ?.details?.message ||
              (data as { error?: string } | null)?.error ||
              raw ||
              "Failed to create task."
          );
        }

        const createdTaskId =
          (data as { task_id?: string } | null)?.task_id ?? "";
        const createdState =
          ((data as { state?: SavedGenerationStatus } | null)?.state ??
            "created") as SavedGenerationStatus;

        if (!createdTaskId) {
          throw new Error("Task created but no task id was returned.");
        }

        return {
          taskId: createdTaskId,
          state: createdState,
          kind: mode,
        };
      });

      const results = await Promise.allSettled(requests);

      const successes = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );

      const failedCount = results.length - successes.length;

      if (failedCount > 0) {
        const refundAmount = perItemCredits * failedCount;
        try {
          await refundCredits(
            refundAmount,
            "Refund for failed image/start-end batch items",
            buildBatchRefundReferenceKey(`${batchKey}:${mode}:${failedCount}`),
            {
              batchKey,
              kind: mode,
              failedCount,
              amountRefunded: refundAmount,
              provider,
              model,
              duration,
              resolution,
              aspect,
            }
          );
        } catch (refundErr) {
          console.error("Image/start-end batch refund failed:", refundErr);
        }
      }

      if (successes.length === 0) {
        throw new Error("No video tasks were created.");
      }

      const timestamp = new Date().toISOString();

      const newGenerations: SavedGeneration[] = successes.map((task, index) =>
        normalizeGeneration({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${index}-${Math.random()}`,
          kind: task.kind,
          taskId: task.taskId,
          prompt,
          provider,
          model,
          duration,
          resolution,
          aspect,
          createdAt: timestamp,
          status: task.state,
          videoUrl: null,
          coverUrl: null,
          error: null,
          chargedCredits: perItemCredits,
          refundStatus: "none",
        })
      );

      setGenerations((prev) => [...newGenerations, ...prev]);
      setSelectedGeneration(newGenerations[0] ?? null);

      if (failedCount > 0) {
        setError(
          `${failedCount} generation${failedCount > 1 ? "s were" : " was"} not created and refunded automatically.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsCreating(false);
      await refreshCredits();
    }
  };

  const createTextToVideo = async () => {
    const batchKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    try {
      setError(null);
      setIsCreating(true);

      if (!user) {
        throw new Error("You must be logged in.");
      }

      if (effectiveCredits != null && effectiveCredits < videoCreditCost) {
        throw new Error(
          `You need ${videoCreditCost} credits, but only have ${effectiveCredits}.`
        );
      }

      if (!prompt.trim()) {
        throw new Error("Please enter a prompt.");
      }

      const perItemCredits = videoCreditCost / amount;

      await deductCredits(videoCreditCost, "Text to video generation", {
        kind: "text-to-video",
        provider,
        model,
        duration,
        resolution,
        aspect,
        amount,
        batchKey,
      });

      const requests = Array.from({ length: amount }, async () => {
        const res = await fetch("/api/vidu/text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            model,
            duration,
            resolution,
            aspectRatio: aspect,
          }),
        });

        const raw = await res.text();
        const data = parseJsonSafely(raw);

        if (!res.ok) {
          throw new Error(
            (data as { details?: { message?: string }; error?: string } | null)
              ?.details?.message ||
              (data as { error?: string } | null)?.error ||
              raw ||
              "Failed to create task."
          );
        }

        const createdTaskId =
          (data as { task_id?: string } | null)?.task_id ?? "";
        const createdState =
          ((data as { state?: SavedGenerationStatus } | null)?.state ??
            "created") as SavedGenerationStatus;

        if (!createdTaskId) {
          throw new Error("Task created but no task id was returned.");
        }

        return {
          taskId: createdTaskId,
          state: createdState,
        };
      });

      const results = await Promise.allSettled(requests);

      const successes = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );

      const failedCount = results.length - successes.length;

      if (failedCount > 0) {
        const refundAmount = perItemCredits * failedCount;
        try {
          await refundCredits(
            refundAmount,
            "Refund for failed text-to-video batch items",
            buildBatchRefundReferenceKey(`${batchKey}:text:${failedCount}`),
            {
              batchKey,
              kind: "text-to-video",
              failedCount,
              amountRefunded: refundAmount,
              provider,
              model,
              duration,
              resolution,
              aspect,
            }
          );
        } catch (refundErr) {
          console.error("Text batch refund failed:", refundErr);
        }
      }

      if (successes.length === 0) {
        throw new Error("No video tasks were created.");
      }

      const timestamp = new Date().toISOString();

      const newGenerations: SavedGeneration[] = successes.map((task, index) =>
        normalizeGeneration({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${index}-${Math.random()}`,
          kind: "text-to-video",
          taskId: task.taskId,
          prompt,
          provider,
          model,
          duration,
          resolution,
          aspect,
          createdAt: timestamp,
          status: task.state,
          videoUrl: null,
          coverUrl: null,
          error: null,
          chargedCredits: perItemCredits,
          refundStatus: "none",
        })
      );

      setGenerations((prev) => [...newGenerations, ...prev]);
      setSelectedGeneration(newGenerations[0] ?? null);

      if (failedCount > 0) {
        setError(
          `${failedCount} generation${failedCount > 1 ? "s were" : " was"} not created and refunded automatically.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsCreating(false);
      await refreshCredits();
    }
  };

  useEffect(() => {
    const pendingGenerations = generations.filter(
      (item) =>
        item.status === "uploading" ||
        item.status === "created" ||
        item.status === "queueing" ||
        item.status === "processing"
    );

    if (pendingGenerations.length === 0) {
      setIsCreating(false);
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const pollOne = async (item: SavedGeneration) => {
      if (item.provider === "kling") {
        const res = await fetch(`/api/kling/tasks/${item.taskId}`, {
          method: "GET",
          cache: "no-store",
        });

        const raw = await res.text();
        const data = parseJsonSafely(raw);

        if (!res.ok) {
          throw new Error(
            (data as { error?: string } | null)?.error ||
              raw ||
              "Failed to fetch Kling task status."
          );
        }

        const typed = data as
          | {
              status?: string;
              videoUrl?: string | null;
              coverUrl?: string | null;
              raw?: any;
            }
          | null;

        const rawStatus = typed?.status?.toLowerCase() ?? "";
        let state: SavedGenerationStatus | null = item.status;

        if (rawStatus.includes("queue")) state = "queueing";
        else if (
          rawStatus.includes("process") ||
          rawStatus.includes("running") ||
          rawStatus.includes("submit")
        ) {
          state = "processing";
        } else if (
          rawStatus.includes("success") ||
          rawStatus.includes("succeed") ||
          rawStatus.includes("completed")
        ) {
          state = "success";
        } else if (rawStatus.includes("fail")) {
          state = "failed";
        }

        return {
          taskId: item.taskId,
          state,
          errCode:
            typed?.raw?.error_code ??
            typed?.raw?.error ??
            typed?.raw?.data?.error ??
            null,
          creation: {
            url: typed?.videoUrl ?? null,
            cover_url: typed?.coverUrl ?? null,
          },
        };
      }

      const res = await fetch(`/api/vidu/tasks/${item.taskId}`, {
        method: "GET",
        cache: "no-store",
      });

      const raw = await res.text();
      const data = parseJsonSafely(raw);

      if (!res.ok) {
        throw new Error(
          (data as { error?: string } | null)?.error ||
            raw ||
            "Failed to fetch task status."
        );
      }

      const typed = data as
        | {
            state?: SavedGenerationStatus;
            err_code?: string;
            creations?: Array<{ url?: string; cover_url?: string }>;
          }
        | null;

      return {
        taskId: item.taskId,
        state: typed?.state ?? null,
        errCode: typed?.err_code ?? null,
        creation: typed?.creations?.[0] ?? null,
      };
    };

    const pollAll = async () => {
      try {
        const results = await Promise.all(
          pendingGenerations.map((item) => pollOne(item))
        );

        if (cancelled) return;

        let newestSuccessful: SavedGeneration | null = null;

        setGenerations((prev) =>
          prev.map((item) => {
            const match = results.find((r) => r.taskId === item.taskId);
            if (!match) return item;

            if (match.state === "success") {
              const updated = {
                ...item,
                status: "success" as const,
                videoUrl: match.creation?.url ?? item.videoUrl,
                coverUrl: match.creation?.cover_url ?? item.coverUrl,
                error: null,
              };

              if (!newestSuccessful) newestSuccessful = updated;
              return updated;
            }

            if (match.state === "failed") {
              return {
                ...item,
                status: "failed" as const,
                error:
                  typeof match.errCode === "string" && match.errCode
                    ? match.errCode
                    : item.provider === "kling"
                      ? "Kling generation failed."
                      : "Vidu generation failed.",
                refundStatus:
                  item.refundStatus === "refunded" ? "refunded" : "pending",
              };
            }

            return {
              ...item,
              status: (match.state ?? item.status) as SavedGenerationStatus,
            };
          })
        );

        if (newestSuccessful) {
          setSelectedGeneration(newestSuccessful);
        }

        const stillPending = results.some(
          (r) =>
            r.state === "uploading" ||
            r.state === "created" ||
            r.state === "queueing" ||
            r.state === "processing"
        );

        setIsCreating(stillPending);

        if (!stillPending && interval) {
          clearInterval(interval);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Polling failed.");
        setIsCreating(false);
        if (interval) clearInterval(interval);
      }
    };

    void pollAll();
    interval = setInterval(pollAll, 4000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [generations]);

  useEffect(() => {
    const failedNeedingRefund = generations.filter(
      (item) => item.status === "failed" && item.refundStatus === "pending"
    );

    if (failedNeedingRefund.length === 0) return;

    let cancelled = false;

    const runRefunds = async () => {
      for (const item of failedNeedingRefund) {
        try {
          await refundCredits(
            item.chargedCredits,
            "Refund for failed video generation",
            buildTaskRefundReferenceKey(item.taskId),
            {
              taskId: item.taskId,
              kind: item.kind,
              provider: item.provider,
              model: item.model,
              duration: item.duration,
              resolution: item.resolution,
              aspect: item.aspect,
              chargedCredits: item.chargedCredits,
              klingMultiShot: item.klingMultiShot ?? false,
              klingShotType: item.klingShotType ?? null,
              klingWithAudio: item.klingWithAudio ?? false,
            }
          );

          if (!cancelled) {
            setGenerations((prev) =>
              prev.map((g) =>
                g.taskId === item.taskId ? { ...g, refundStatus: "refunded" } : g
              )
            );
          }
        } catch (refundErr) {
          console.error("Video refund failed:", refundErr);
        }
      }
    };

    void runRefunds();

    return () => {
      cancelled = true;
    };
  }, [generations]);

  useEffect(() => {
    if (!selectedGeneration && generations.length > 0) {
      setSelectedGeneration(generations[0]);
    }
  }, [generations, selectedGeneration]);

  useEffect(() => {
  if (!selectedGeneration) return;

  const latestSelected = generations.find(
    (item) => item.id === selectedGeneration.id
  );

  if (!latestSelected) return;

  if (
    latestSelected.videoUrl !== selectedGeneration.videoUrl ||
    latestSelected.coverUrl !== selectedGeneration.coverUrl ||
    latestSelected.status !== selectedGeneration.status ||
    latestSelected.error !== selectedGeneration.error ||
    latestSelected.refundStatus !== selectedGeneration.refundStatus
  ) {
    setSelectedGeneration(latestSelected);
  }
}, [generations, selectedGeneration]);

  const currentTask = generations.find(
    (item) =>
      item.status === "uploading" ||
      item.status === "created" ||
      item.status === "queueing" ||
      item.status === "processing"
  );

  const recentGenerations = generations.slice(0, 6);

  const filteredHistory = useMemo(() => {
    return generations.filter((item) => {
      const searchMatch = item.prompt
        .toLowerCase()
        .includes(historySearch.toLowerCase());

      if (!searchMatch) return false;

      if (historyFilter === "all") return true;
      if (historyFilter === "success") return item.status === "success";
      if (historyFilter === "failed") return item.status === "failed";
      if (historyFilter === "processing") {
        return (
          item.status === "uploading" ||
          item.status === "created" ||
          item.status === "queueing" ||
          item.status === "processing"
        );
      }

      return true;
    });
  }, [generations, historyFilter, historySearch]);

  const applyPromptPreset = (preset: string) => {
    setPrompt((prev) => (prev ? `${prev.trim()}, ${preset}` : preset));
  };

  const reusePrompt = (item: SavedGeneration) => {
    setPrompt(item.prompt);
  };

  const reuseSettings = (item: SavedGeneration) => {
    if (
      item.kind === "reference-to-video" ||
      item.kind === "image-to-video" ||
      item.kind === "start-end-to-video" ||
      item.kind === "text-to-video"
    ) {
      if (item.kind === "reference-to-video") {
        router.push("/create/video?tab=reference-to-video");
      } else if (item.kind === "text-to-video") {
        router.push("/create/video?tab=text-to-video");
      } else {
        router.push("/create/video?tab=image-to-video");
      }
    }

    setProvider(item.provider);
    setModel(item.model);
    setDuration(item.duration);
    setResolution(item.resolution);
    setAspect(item.aspect);

    if (item.provider === "kling") {
      setKlingMultiShot(item.klingMultiShot ?? false);
      setKlingShotType(item.klingShotType ?? "intelligence");
      setKlingWithAudio(item.klingWithAudio ?? false);
    }
  };

  const remixGeneration = (item: SavedGeneration) => {
    reuseSettings(item);
    setPrompt(`${item.prompt}, remix variation, enhanced cinematic motion`);
  };

  const renderTimeline = currentTask ? getTimelineSteps(currentTask.status) : [];

    return (
    <div className="relative min-h-screen overflow-x-hidden text-white">
      <WallpaperRevealBackground src="/wallpaper.jpg" radius={260} />

      <div className="relative z-10 mx-auto max-w-[1580px] px-5 py-5 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
        >
          <div className="flex flex-wrap items-center gap-2">
            <TopbarButton
              onClick={goToolsHome}
              icon={<Home size={16} className="opacity-80" />}
            >
              Home
            </TopbarButton>

            <TopbarButton
              onClick={goImageWorkspace}
              icon={<ImageIcon size={16} className="opacity-80" />}
            >
              Switch to AI Image
            </TopbarButton>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CreditsPill credits={effectiveCredits} loading={!creditsAreResolved && authLoading} />

            <TopbarButton
              onClick={goPricing}
              highlighted
              icon={<Gift size={16} className="opacity-80" />}
            >
              Buy Credits
            </TopbarButton>

            <TopbarButton
              onClick={goPricing}
              icon={<Crown size={16} className="opacity-80" />}
            >
              Subscribe
            </TopbarButton>

            <button
              type="button"
              onClick={goToolsHome}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:border-white/20 hover:bg-white/[0.07]"
              aria-label="Notifications"
            >
              <Bell size={16} />
            </button>

            <TopbarButton
              onClick={() => void logout()}
              icon={<LogOut size={16} className="opacity-80" />}
            >
              Log out
            </TopbarButton>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.35 }}
          className="mt-5 grid gap-5 lg:grid-cols-[460px_1fr]"
        >
          <GlassPanel className="p-4">
            <div className="rounded-[24px] border border-white/10 bg-black/22 p-2">
              <div className="flex gap-1">
                {VIDEO_TOOLS.map((t) => (
                  <ToolTab
                    key={t.key}
                    label={t.label}
                    active={active === t.key}
                    onClick={() => onChangeTool(t.key)}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-black/22 p-4">
                <SectionTitle icon={<SlidersHorizontal size={14} />} kicker="Provider">
                  AI Provider
                </SectionTitle>

                <div className="mt-4">
                  <ProviderCardSelector
                    value={provider}
                    options={providerOptions}
                    onChange={setProvider}
                  />
                </div>

                {active !== "image-to-video" && (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/55">
                    Kling is only available for Image to Video.
                  </div>
                )}

                {active === "image-to-video" && klingAvailable && (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/55">
                    Kling uses only <span className="text-white/80">kling-v3</span> and only inside Image to Video.
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-black/22 p-4">
                <SectionTitle icon={<Upload size={14} />} kicker="Inputs">
                  Source Material
                </SectionTitle>

                <div className="mt-4 space-y-4">
                  {active === "reference-to-video" && (
                    <>
                      <div className="rounded-[24px] border border-white/10 bg-black/18 p-2">
                        <div className="flex gap-1">
                          <MiniTab
                            label="Reference Images"
                            active={referenceInputMode === "images"}
                            onClick={() => setReferenceInputMode("images")}
                          />
                          <MiniTab
                            label="Named Subjects"
                            active={referenceInputMode === "subjects"}
                            onClick={() => setReferenceInputMode("subjects")}
                            disabled={!canUseSubjectMode}
                          />
                        </div>
                      </div>

                      {!canUseSubjectMode && (
                        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100">
                          Named Subjects are currently available with Vidu Q2. Vidu Q2 Pro uses plain image references only.
                        </div>
                      )}

                      {referenceInputMode === "images" ? (
                        <UploadRow
                          title="Reference Images"
                          subtitle="Upload 1 to 7 images"
                          accept="image/*"
                          multiple={true}
                          files={refImages}
                          maxFiles={7}
                          onAddFiles={setRefImages}
                        />
                      ) : (
                        <>
                          <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-black/18 p-4">
                            <div>
                              <div className="text-sm font-semibold text-white/92">
                                Named Subjects
                              </div>
                              <div className="mt-1 text-xs text-white/50">
                                Add 1 to 7 subjects. Each subject can contain up to 3 images.
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={addSubject}
                              disabled={subjects.length >= 7}
                              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus size={16} />
                              Add subject
                            </button>
                          </div>

                          {subjects.length > 0 ? (
                            <div className="space-y-3">
                              {subjects.map((subject) => (
                                <SubjectCard
                                  key={subject.id}
                                  subject={subject}
                                  onChangeName={(value) =>
                                    updateSubject(subject.id, (prev) => ({
                                      ...prev,
                                      name: value,
                                    }))
                                  }
                                  onAddFiles={(files) =>
                                    updateSubject(subject.id, (prev) => ({
                                      ...prev,
                                      files: [...prev.files, ...files].slice(0, 3),
                                    }))
                                  }
                                  onRemoveFile={(index) =>
                                    updateSubject(subject.id, (prev) => ({
                                      ...prev,
                                      files: prev.files.filter((_, i) => i !== index),
                                    }))
                                  }
                                  onRemoveSubject={() => removeSubject(subject.id)}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-white/45">
                              No subjects added yet.
                            </div>
                          )}

                          <div className="text-[11px] text-white/38">
                            Total subject images: {subjectImageCount}/7
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {active === "image-to-video" && (
                    <>
                      <input
                        ref={startInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          if (f) setStartFile(f);
                          e.currentTarget.value = "";
                        }}
                      />
                      <input
                        ref={endInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          if (f) setEndFile(f);
                          e.currentTarget.value = "";
                        }}
                      />

                      <div className="rounded-[24px] border border-white/10 bg-black/18 p-4">
                        <div>
                          <div className="text-sm font-semibold text-white/90">
                            Upload Frames
                          </div>
                          <div className="mt-1 text-xs text-white/55">
                            Upload Frame 1 for image-to-video, or both Frame 1 and Frame 2 for start-end-to-video
                          </div>
                        </div>

                        <div className="mt-4 flex gap-3">
                          <FrameSlot
                            index={1}
                            label="Frame 1 (Start)"
                            previewUrl={startPreview}
                            onPick={() => startInputRef.current?.click()}
                            onClear={() => setStartFile(null)}
                          />
                          <FrameSlot
                            index={2}
                            label="Frame 2 (End)"
                            previewUrl={endPreview}
                            onPick={() => endInputRef.current?.click()}
                            onClear={() => setEndFile(null)}
                          />
                        </div>
                      </div>

                      {isKling && (
                        <div className="rounded-[24px] border border-white/10 bg-black/18 p-4">
                          <SectionTitle icon={<Clapperboard size={14} />} kicker="Kling v3">
                            Kling Story Controls
                          </SectionTitle>

                          <div className="mt-4 space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!klingMultiShotLockedByEndFrame) {
                                    setKlingMultiShot((prev) => !prev);
                                  }
                                }}
                                disabled={klingMultiShotLockedByEndFrame}
                                className={cn(
                                  "rounded-2xl border p-4 text-left transition",
                                  klingMultiShot
                                    ? "border-violet-300/25 bg-violet-400/12"
                                    : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/10",
                                  klingMultiShotLockedByEndFrame &&
                                    "cursor-not-allowed opacity-50"
                                )}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-white/92">
                                    Multi-shot
                                  </div>
                                  <div
                                    className={cn(
                                      "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]",
                                      klingMultiShot
                                        ? "border-violet-300/20 bg-violet-400/10 text-violet-100"
                                        : "border-white/10 bg-black/35 text-white/60"
                                    )}
                                  >
                                    {klingMultiShot ? "On" : "Off"}
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-white/48">
                                  Turn one start frame into a storyboard-driven video.
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setKlingWithAudio((prev) => !prev)}
                                className={cn(
                                  "rounded-2xl border p-4 text-left transition",
                                  klingWithAudio
                                    ? "border-violet-300/25 bg-violet-400/12"
                                    : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/10"
                                )}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-white/92">
                                    Audio
                                  </div>
                                  <div
                                    className={cn(
                                      "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]",
                                      klingWithAudio
                                        ? "border-violet-300/20 bg-violet-400/10 text-violet-100"
                                        : "border-white/10 bg-black/35 text-white/60"
                                    )}
                                  >
                                    {klingWithAudio ? "On" : "Off"}
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-white/48">
                                  Request audio generation from Kling.
                                </div>
                              </button>
                            </div>

                            {klingMultiShotLockedByEndFrame && (
                              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100">
                                Multi-shot is disabled while an end frame exists. Remove Frame 2 to enable Kling multi-shot.
                              </div>
                            )}

                            <div>
                              <div className="mb-2 text-sm text-white/70">Quality mode</div>
                              <ChipSelector
                                value={klingMode}
                                onChange={(next) => setKlingMode(next as KlingMode)}
                                options={[
                                  { value: "std", label: "Standard", meta: "balanced" },
                                  { value: "pro", label: "Pro", meta: "higher quality" },
                                ]}
                              />
                            </div>

                            {klingMultiShot && (
                              <>
                                <div>
                                  <div className="mb-2 text-sm text-white/70">Shot type</div>
                                  <div className="rounded-[24px] border border-white/10 bg-black/18 p-2">
                                    <div className="flex gap-1">
                                      <MiniTab
                                        label="Auto"
                                        active={klingShotType === "intelligence"}
                                        onClick={() => setKlingShotType("intelligence")}
                                      />
                                      <MiniTab
                                        label="Custom"
                                        active={klingShotType === "customize"}
                                        onClick={() => setKlingShotType("customize")}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {klingShotType === "intelligence" ? (
                                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-white/55">
                                    Auto mode uses your main prompt and lets Kling intelligently split the scene into multiple shots.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-black/18 p-4">
                                      <div>
                                        <div className="text-sm font-semibold text-white/92">
                                          Custom Shot Builder
                                        </div>
                                        <div className="mt-1 text-xs text-white/50">
                                          Up to 6 shots. The total duration must equal {duration}s.
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={addKlingCustomShot}
                                        disabled={klingCustomShots.length >= 6}
                                        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        <Plus size={16} />
                                        Add shot
                                      </button>
                                    </div>

                                    {klingCustomShots.map((shot, index) => (
                                      <div
                                        key={shot.id}
                                        className="rounded-[24px] border border-white/10 bg-black/18 p-4"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <div className="text-sm font-semibold text-white/92">
                                              Shot {index + 1}
                                            </div>
                                            <div className="mt-1 text-xs text-white/50">
                                              Define the action and timing for this storyboard shot.
                                            </div>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => removeKlingCustomShot(shot.id)}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:bg-white/[0.08]"
                                            title="Remove shot"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>

                                        <textarea
                                          value={shot.prompt}
                                          onChange={(e) =>
                                            updateKlingCustomShot(shot.id, (prev) => ({
                                              ...prev,
                                              prompt: e.target.value,
                                            }))
                                          }
                                          placeholder="Describe this specific shot..."
                                          className="mt-4 h-28 w-full resize-none rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/36 outline-none transition focus:border-white/25 focus:bg-black/35"
                                        />

                                        <div className="mt-4">
                                          <div className="mb-2 text-sm text-white/70">
                                            Shot duration
                                          </div>
                                          <div className="grid grid-cols-6 gap-2">
                                            {[1, 2, 3, 4, 5, 6].map((n) => (
                                              <button
                                                key={n}
                                                type="button"
                                                onClick={() =>
                                                  updateKlingCustomShot(shot.id, (prev) => ({
                                                    ...prev,
                                                    duration: n,
                                                  }))
                                                }
                                                className={cn(
                                                  "cursor-pointer rounded-2xl border px-3 py-3 text-sm font-medium transition",
                                                  shot.duration === n
                                                    ? "border-violet-300/25 bg-violet-400/12 text-white shadow-[0_10px_24px_rgba(139,92,246,0.12)]"
                                                    : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:bg-black/10"
                                                )}
                                              >
                                                {n}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ))}

                                    <div
                                      className={cn(
                                        "rounded-2xl border px-3 py-2.5 text-xs",
                                        klingCustomShotsValid
                                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                          : "border-amber-300/20 bg-amber-400/10 text-amber-100"
                                      )}
                                    >
                                      Custom shot total: {klingCustomDurationSum}s / {duration}s
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {active === "text-to-video" && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-white/45">
                      No reference uploads needed for text-to-video.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-black/22 p-4">
                <SectionTitle icon={<Sparkles size={14} />} kicker="Prompt">
                  Scene Direction
                </SectionTitle>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="mt-4 h-36 w-full resize-none rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/36 outline-none transition focus:border-white/25 focus:bg-black/35"
                  placeholder={
                    active === "reference-to-video" && referenceInputMode === "subjects"
                      ? "Describe the scene and reference your subjects like @hero or @girl..."
                      : active === "text-to-video"
                        ? "Write the full scene prompt..."
                        : isKling && klingMultiShot && klingShotType === "customize"
                          ? "Optional in custom multi-shot mode. Each shot can have its own prompt."
                          : "Describe motion, camera, lighting, mood, style..."
                  }
                />

                {isKling && (
                  <div className="mt-4">
                    <div className="mb-2 text-sm text-white/70">Negative prompt</div>
                    <textarea
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      className="h-28 w-full resize-none rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/36 outline-none transition focus:border-white/25 focus:bg-black/35"
                      placeholder="Things you want Kling to avoid..."
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyPromptPreset(preset)}
                      className="cursor-pointer rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-black/22 p-4">
                <SectionTitle icon={<SlidersHorizontal size={14} />} kicker="Settings">
                  Generation Settings
                </SectionTitle>

                <div className="mt-4 space-y-5">
                  <div>
                    <div className="mb-2 text-sm text-white/70">Model</div>
                    <ModelCardSelector
                      value={model}
                      options={modelOptions}
                      onChange={setModel}
                      kind={currentKind}
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-white/70">Duration</div>
                    <div className="grid grid-cols-6 gap-2">
                      {ALL_DURATION_OPTIONS.map((d) => {
                        const enabled = allowedDurations.includes(d);

                        return (
                          <motion.button
                            key={d}
                            type="button"
                            onClick={() => enabled && setDuration(d)}
                            whileTap={enabled ? { scale: 0.97 } : undefined}
                            disabled={!enabled}
                            className={cn(
                              "cursor-pointer rounded-2xl border px-3 py-3 text-sm font-medium transition",
                              duration === d
                                ? "border-violet-300/25 bg-violet-400/12 text-white shadow-[0_10px_24px_rgba(139,92,246,0.12)]"
                                : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:bg-black/10",
                              !enabled && "cursor-not-allowed opacity-30"
                            )}
                          >
                            {d}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-white/70">Resolution</div>
                    <ChipSelector
                      value={resolution}
                      onChange={setResolution}
                      options={allowedResolutions.map((r) => ({
                        value: r,
                        label: r,
                        meta:
                          r === "540p"
                            ? "fastest"
                            : r === "720p"
                              ? "balanced"
                              : r === "1080p"
                                ? "highest quality"
                                : "",
                      }))}
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-white/70">Aspect Ratio</div>
                    <ChipSelector
                      value={aspect}
                      onChange={setAspect}
                      options={allowedAspects.map((a) => ({ value: a }))}
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-white/70">Amount</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((n) => (
                        <motion.button
                          key={n}
                          type="button"
                          onClick={() => setAmount(n)}
                          whileTap={{ scale: 0.97 }}
                          className={cn(
                            "cursor-pointer rounded-2xl border px-3 py-3 text-sm font-medium transition",
                            amount === n
                              ? "border-violet-300/25 bg-violet-400/12 text-white shadow-[0_10px_24px_rgba(139,92,246,0.12)]"
                              : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:bg-black/10"
                          )}
                        >
                          {n}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-4 z-20 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.95),rgba(10,10,14,0.95))] p-4 backdrop-blur-2xl shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <SectionTitle icon={<Coins size={14} />} kicker="Summary">
                  Ready to Generate
                </SectionTitle>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <StatCard label="Generation cost" value={`${videoCreditCost} credits`} />
                  <StatCard
                    label="Balance after"
                    value={remainingCreditsAfterCreate ?? "Loading..."}
                    danger={
                      remainingCreditsAfterCreate != null &&
                      remainingCreditsAfterCreate < 0
                    }
                  />
                </div>

                {!hasEnoughCredits && creditsAreResolved && (
                  <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
                    You do not have enough credits for this video generation.
                  </div>
                )}

                {isKling && klingMultiShot && klingShotType === "customize" && !klingCustomShotsValid && (
                  <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-100">
                    Your custom shot builder is not valid yet. Every shot needs a prompt and the summed durations must exactly match the selected duration.
                  </div>
                )}

                <AnimatePresence>
                  {showTopupPanel && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 overflow-hidden rounded-[22px] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(255,224,138,0.08),rgba(255,196,77,0.03))] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-amber-50">
                            Top up your credits
                          </div>
                          <div className="mt-1 text-xs leading-relaxed text-amber-100/65">
                            Buy one-time credit packs without changing your subscription.
                            Purchased top-up credits persist through monthly resets.
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowTopupPanel(false)}
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/70 transition hover:border-white/20 hover:bg-black/30 hover:text-white"
                          aria-label="Close top-up panel"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="mt-4">
                        <TopupButtons />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    if (active === "reference-to-video") {
                      void createReferenceToVideo();
                      return;
                    }

                    if (active === "image-to-video") {
                      void createImageOrStartEndVideo();
                      return;
                    }

                    if (active === "text-to-video") {
                      void createTextToVideo();
                    }
                  }}
                  disabled={
                    isCreating ||
                    !creditsAreResolved ||
                    !hasEnoughCredits ||
                    authLoading ||
                    (isKling &&
                      klingMultiShot &&
                      klingShotType === "customize" &&
                      !klingCustomShotsValid)
                  }
                  className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles size={16} />
                  <span>
                    {isCreating
                      ? `Generating ${amount} video${amount > 1 ? "s" : ""}...`
                      : !creditsAreResolved
                        ? "Loading credits..."
                        : !hasEnoughCredits
                          ? `Insufficient credits • Need ${videoCreditCost}`
                          : `Create • ${videoCreditCost} credits`}
                  </span>
                </motion.button>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/42">
                  Workspace
                </div>
                <div className="mt-1 text-xl font-semibold">{toolLabel}</div>
                <div className="mt-1 text-xs text-white/45">
                  Latest result and recent generations
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">
                {mounted ? new Date().toLocaleString() : "—"}
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {currentTask && (
              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                      Current Task
                    </div>
                    <div className="mt-1 text-sm text-white/75">
                      {prettyStatus(currentTask.status)}
                    </div>
                  </div>
                  <div className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-100">
                    {formatViduModelName(currentTask.model)} • {currentTask.resolution} • {currentTask.duration}s
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {renderTimeline.map((step, index) => (
                    <div
                      key={`${step.label}-${index}`}
                      className={cn(
                        "rounded-2xl border px-3 py-3 text-center text-xs transition",
                        step.done
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                          : step.active
                            ? "border-violet-400/20 bg-violet-400/10 text-violet-100"
                            : "border-white/10 bg-black/20 text-white/45"
                      )}
                    >
                      <div className="mb-1 flex justify-center">
                        {step.done ? (
                          <CheckCircle2 size={14} />
                        ) : step.active ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border border-white/20" />
                        )}
                      </div>
                      {step.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.28fr_0.72fr]">
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/18">
                <div className="border-b border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        {selectedGeneration
                          ? kindLabel(selectedGeneration.kind)
                          : "Latest Preview"}
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        {selectedGeneration
                          ? new Date(selectedGeneration.createdAt).toLocaleString()
                          : "Your generated videos will appear here."}
                      </div>
                    </div>

                    {selectedGeneration && (
                      <div
                        className={cn(
                          "rounded-2xl border px-3 py-2 text-xs",
                          getStatusBadgeClasses(selectedGeneration.status)
                        )}
                      >
                        {prettyStatus(selectedGeneration.status)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  {selectedGeneration ? (
                    <>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={selectedGeneration.id}
                          initial={{ opacity: 0, scale: 0.985 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.985 }}
                          transition={{ duration: 0.22 }}
                        >
                          {selectedGeneration.videoUrl ? (
                            <video
                              className="max-h-[720px] w-full rounded-[24px] border border-white/10 bg-black object-contain"
                              src={selectedGeneration.videoUrl}
                              controls
                              playsInline
                              poster={selectedGeneration.coverUrl ?? undefined}
                            />
                          ) : selectedGeneration.status === "failed" ? (
                            <div className="flex min-h-[440px] items-center justify-center rounded-[24px] border border-red-500/20 bg-red-500/10 px-6 text-center text-sm text-red-200">
                              {selectedGeneration.error || "Generation failed."}
                            </div>
                          ) : (
                            <div className="flex min-h-[440px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03]">
                              <div className="flex flex-col items-center gap-4">
                                <div className="relative h-12 w-12">
                                  <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-white/80" />
                                </div>
                                <div className="text-center">
                                  <div className="text-sm font-medium text-white/90">
                                    {prettyStatus(selectedGeneration.status)}
                                  </div>
                                  <div className="mt-1 text-xs text-white/50">
                                    {formatProviderName(selectedGeneration.provider)} is working on this generation.
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>

                      <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                          Prompt
                        </div>
                        <div className="mt-2 text-sm leading-6 text-white/70">
                          {selectedGeneration.prompt}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
                          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                            {formatProviderName(selectedGeneration.provider)}
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                            {formatViduModelName(selectedGeneration.model)}
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                            {selectedGeneration.duration}s
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                            {selectedGeneration.resolution}
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                            {selectedGeneration.aspect}
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                            {selectedGeneration.chargedCredits} credits
                          </div>
                          {selectedGeneration.provider === "kling" && (
                            <>
                              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                                audio: {selectedGeneration.klingWithAudio ? "on" : "off"}
                              </div>
                              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                                multi-shot: {selectedGeneration.klingMultiShot ? "on" : "off"}
                              </div>
                              {selectedGeneration.klingMultiShot && selectedGeneration.klingShotType && (
                                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                                  shot type: {selectedGeneration.klingShotType}
                                </div>
                              )}
                            </>
                          )}
                          {selectedGeneration.status === "failed" && (
                            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                              refund: {selectedGeneration.refundStatus}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => reusePrompt(selectedGeneration)}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/[0.06]"
                          >
                            <Wand2 size={15} />
                            Reuse prompt
                          </button>

                          <button
                            type="button"
                            onClick={() => reuseSettings(selectedGeneration)}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/[0.06]"
                          >
                            <SlidersHorizontal size={15} />
                            Reuse settings
                          </button>

                          <button
                            type="button"
                            onClick={() => remixGeneration(selectedGeneration)}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-400/10 px-4 py-2.5 text-sm text-violet-100 transition hover:border-violet-200/30 hover:bg-violet-400/15"
                          >
                            <Sparkles size={15} />
                            Remix this
                          </button>

                          {selectedGeneration.videoUrl && (
                            <a
                              href={selectedGeneration.videoUrl}
                              download={`koa-video-${selectedGeneration.id}.mp4`}
                              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/[0.06]"
                            >
                              <Download size={15} />
                              Download video
                            </a>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-100">
                          <Clapperboard size={20} />
                        </div>

                        <div>
                          <div className="text-lg font-semibold text-white">
                            Create cinematic AI video
                          </div>
                          <div className="mt-1 max-w-xl text-sm text-white/55">
                            Build motion-driven clips with text prompts, start/end frames, or reference material. Everything you render appears here.
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {["Text to video", "Image to video", "Reference guided"].map(
                              (pill) => (
                                <div
                                  key={pill}
                                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70"
                                >
                                  {pill}
                                </div>
                              )
                            )}
                          </div>

                          <div className="mt-5 grid gap-3 md:grid-cols-2">
                            {[
                              "/backgrounds/1.mp4",
                              "/backgrounds/2.mp4",
                              "/backgrounds/3.mp4",
                              "/backgrounds/4.mp4",
                            ].map((src) => (
                              <div
                                key={src}
                                className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                              >
                                <video
                                  className="h-56 w-full object-cover"
                                  src={src}
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  preload="metadata"
                                />
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/18 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white/90">Recent</div>
                    <div className="mt-1 text-xs text-white/45">
                      Click a card to preview it
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/60">
                    {generations.length} total
                  </div>
                </div>

                {recentGenerations.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {recentGenerations.map((item) => (
                      <motion.button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedGeneration(item)}
                        whileHover={{ y: -2 }}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-2 text-left transition",
                          selectedGeneration?.id === item.id
                            ? "border-white/20 bg-white/[0.08]"
                            : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
                          {item.videoUrl ? (
                            <video
                              className="h-full w-full object-cover"
                              src={item.videoUrl}
                              poster={item.coverUrl ?? undefined}
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : item.coverUrl ? (
                            <img
                              src={item.coverUrl}
                              alt={item.prompt}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-white/45">
                              {item.status === "failed" ? "FAIL" : "..."}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-sm text-white/85">
                            {item.prompt || "Untitled generation"}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/45">
                            <span>{new Date(item.createdAt).toLocaleString()}</span>
                            <span>•</span>
                            <span>{item.chargedCredits} credits</span>
                            <span>•</span>
                            <span>{formatProviderName(item.provider)}</span>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-white/50">
                    No generations yet.
                  </div>
                )}
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
          className="mt-6"
        >
          <GlassPanel className="p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/42">
                  History
                </div>
                <div className="mt-1 flex items-center gap-2 text-xl font-semibold text-white">
                  <Layers3 size={20} className="text-white/65" />
                  All Generated Videos
                </div>
                <div className="mt-1 text-sm text-white/45">
                  Browse, search, and filter your motion history
                </div>
              </div>

              {generations.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setGenerations([]);
                    setSelectedGeneration(null);
                    setError(null);
                    setHistorySearch("");
                    setHistoryFilter("all");
                    try {
                      localStorage.removeItem(GENERATIONS_STORAGE_KEY);
                    } catch {}
                  }}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <Trash2 size={15} />
                  Clear history
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {(["all", "success", "failed", "processing"] as const).map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setHistoryFilter(filter)}
                      className={cn(
                        "cursor-pointer rounded-full border px-3 py-1.5 text-xs transition",
                        historyFilter === filter
                          ? "border-violet-300/20 bg-violet-400/10 text-violet-100"
                          : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.06]"
                      )}
                    >
                      {filter}
                    </button>
                  )
                )}
              </div>

              <div className="relative w-full md:w-[320px]">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search prompt history..."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-10 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/20"
                />
              </div>
            </div>

            {filteredHistory.length > 0 ? (
              <div className="mt-5 columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
                {filteredHistory.map((item) => (
                  <div key={item.id} className="mb-4 break-inside-avoid">
                    <VideoHistoryCard
                      item={item}
                      onOpen={(picked) => setSelectedGeneration(picked)}
                    />
                  </div>
                ))}
              </div>
            ) : generations.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/50">
                No items match your current filters.
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {[
                  "/backgrounds/1.mp4",
                  "/backgrounds/2.mp4",
                  "/backgrounds/3.mp4",
                  "/backgrounds/4.mp4",
                  "/backgrounds/5.mp4",
                  "/backgrounds/6.mp4",
                  "/backgrounds/7.mp4",
                  "/backgrounds/8.mp4",
                  "/backgrounds/9.mp4",
                ].map((src, index) => (
                  <div
                    key={`${src}-${index}`}
                    className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/30"
                  >
                    <video
                      className="h-[320px] w-full object-cover"
                      src={src}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[11px] text-white/60 backdrop-blur">
                      <div className="flex items-center gap-1.5">
                        <Video size={12} />
                        Gallery preview
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </motion.div>
      </div>
    </div>
  );
}