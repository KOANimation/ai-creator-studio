"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  Palette,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import TopupButtons from "@/app/components/TopupButtons";

type ImageToolKey = "reference-to-image" | "text-to-image";
type ImageProvider = "google" | "openai" | "byteplus";

type BytePlusModel =
  | "seedream-5-0-260128"
  | "seedream-4-5-251128"
  | "seedream-4-0-250828"
  | "seedream-3-0-t2i-250415";

type SavedImageGenerationStatus = "processing" | "success" | "failed";
type RefundStatus = "none" | "pending" | "refunded";

type SavedImageGeneration = {
  id: string;
  kind: ImageToolKey;
  provider: ImageProvider;
  prompt: string;
  model: string;
  aspect: string;
  outputFormat: string;
  amountRequest: number;
  createdAt: string;
  status: SavedImageGenerationStatus;
  imageUrl: string | null;
  mimeType: string | null;
  note: string | null;
  error: string | null;
  referenceCount: number;
  chargedCredits: number;
  refundStatus: RefundStatus;
  requestKey: string;
};

const IMAGE_TOOLS: { key: ImageToolKey; label: string }[] = [
  { key: "reference-to-image", label: "Reference to Image" },
  { key: "text-to-image", label: "Text to Image" },
];

const ALL_ASPECT_OPTIONS = ["16:9", "9:16", "1:1", "4:3"];
const ALL_FORMAT_OPTIONS = ["PNG", "JPG", "WEBP"];
const IMAGE_GENERATIONS_STORAGE_KEY = "koa_image_generations_v1";

const IMAGE_DB_NAME = "koa-image-db";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE_NAME = "previews";

const GOOGLE_MODEL_VALUE = "nano-banana-pro";
const OPENAI_MODEL_VALUE = "gpt-image-1.5";

const BYTEPLUS_MODELS: Array<{
  value: BytePlusModel;
  label: string;
  refCapable: boolean;
}> = [
  { value: "seedream-5-0-260128", label: "Seedream 5.0", refCapable: true },
  { value: "seedream-4-5-251128", label: "Seedream 4.5", refCapable: true },
  { value: "seedream-4-0-250828", label: "Seedream 4.0", refCapable: true },
  {
    value: "seedream-3-0-t2i-250415",
    label: "Seedream 3.0",
    refCapable: false,
  },
];

const PROMPT_PRESETS = [
  "cinematic composition, dramatic lighting, highly detailed",
  "old anime OVA look, cel shading, rich atmospheric depth",
  "editorial beauty lighting, elegant composition, luxury aesthetic",
  "dark moody scene, rim light, high contrast, premium look",
  "clean product render, crisp details, studio lighting",
  "dreamy soft light, subtle bloom, ethereal atmosphere",
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatImageProviderName(provider: ImageProvider) {
  switch (provider) {
    case "google":
      return "Google";
    case "openai":
      return "OpenAI";
    case "byteplus":
      return "BytePlus";
    default:
      return provider;
  }
}

function getImageProviderMeta(provider: ImageProvider) {
  switch (provider) {
    case "google":
      return "balanced image generation";
    case "openai":
      return "premium prompt fidelity";
    case "byteplus":
      return "seedream family";
    default:
      return "";
  }
}

function formatImageModelName(
  provider: ImageProvider,
  model: string,
  byteplusModel?: BytePlusModel
) {
  if (provider === "google") return "Nano Banana Pro";
  if (provider === "openai") return "GPT Image 1.5";

  const match = BYTEPLUS_MODELS.find((item) => item.value === byteplusModel);
  if (match) return match.label;

  const byLabel = BYTEPLUS_MODELS.find((item) => item.label === model);
  if (byLabel) return byLabel.label;

  return model;
}

function getImageModelMeta(
  provider: ImageProvider,
  activeTool: ImageToolKey,
  model: string
) {
  if (provider === "google") {
    return "reliable general-purpose image generation";
  }

  if (provider === "openai") {
    return "strong prompt fidelity and premium output";
  }

  if (model === "seedream-5-0-260128") return "highest quality";
  if (model === "seedream-4-5-251128") return "balanced premium";
  if (model === "seedream-4-0-250828") return "fast + capable";
  if (model === "seedream-3-0-t2i-250415") {
    return activeTool === "reference-to-image"
      ? "text to image only • no refs"
      : "text to image only";
  }

  return "image generation";
}

function getProviderModelOptions(
  provider: ImageProvider,
  activeTool: ImageToolKey
): string[] {
  if (provider === "google") {
    return [GOOGLE_MODEL_VALUE];
  }

  if (provider === "openai") {
    return [OPENAI_MODEL_VALUE];
  }

  if (activeTool === "reference-to-image") {
    return BYTEPLUS_MODELS.filter((item) => item.refCapable).map(
      (item) => item.value
    );
  }

  return BYTEPLUS_MODELS.map((item) => item.value);
}

function getDefaultModelForProvider(
  provider: ImageProvider,
  activeTool: ImageToolKey
) {
  const options = getProviderModelOptions(provider, activeTool);
  return options[0] ?? GOOGLE_MODEL_VALUE;
}

function getImageGenerationCost({
  provider,
  active,
  model,
  amount,
  refCount,
}: {
  provider: ImageProvider;
  active: ImageToolKey;
  model: string;
  amount: number;
  refCount: number;
}) {
  let perImageCost = 0;

  if (provider === "google") {
    perImageCost = active === "reference-to-image" ? 14 : 10;
  } else if (provider === "openai") {
    perImageCost = active === "reference-to-image" ? 18 : 12;
  } else if (provider === "byteplus") {
    switch (model as BytePlusModel) {
      case "seedream-5-0-260128":
        perImageCost = active === "reference-to-image" ? 22 : 16;
        break;
      case "seedream-4-5-251128":
        perImageCost = active === "reference-to-image" ? 18 : 14;
        break;
      case "seedream-4-0-250828":
        perImageCost = active === "reference-to-image" ? 15 : 12;
        break;
      case "seedream-3-0-t2i-250415":
        perImageCost = 9;
        break;
      default:
        perImageCost = active === "reference-to-image" ? 15 : 12;
        break;
    }
  }

  let extraRefCost = 0;
  if (active === "reference-to-image") {
    extraRefCost = Math.max(0, refCount - 1) * 2;
  }

  return (perImageCost + extraRefCost) * amount;
}

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        db.createObjectStore(IMAGE_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePreviewToDb(id: string, imageUrl: string | null) {
  if (!imageUrl) return;

  const db = await openImageDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
    const store = tx.objectStore(IMAGE_STORE_NAME);
    store.put(imageUrl, id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  db.close();
}

async function loadPreviewFromDb(id: string): Promise<string | null> {
  const db = await openImageDb();

  const result = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readonly");
    const store = tx.objectStore(IMAGE_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as string) || null);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return result;
}

async function clearAllPreviewsFromDb() {
  const db = await openImageDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
    const store = tx.objectStore(IMAGE_STORE_NAME);
    store.clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  db.close();
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

function prettyImageStatus(status: SavedImageGenerationStatus) {
  switch (status) {
    case "processing":
      return "Generating image";
    case "success":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Generating image";
  }
}

function getStatusBadgeClasses(status: SavedImageGenerationStatus) {
  if (status === "success") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }
  if (status === "failed") {
    return "border-red-400/20 bg-red-400/10 text-red-200";
  }
  return "border-white/10 bg-black/40 text-white/70";
}

function kindLabel(kind: ImageToolKey) {
  switch (kind) {
    case "reference-to-image":
      return "Reference to Image";
    case "text-to-image":
      return "Text to Image";
    default:
      return "Image";
  }
}

function getFilePreviewUrl(file: File) {
  return URL.createObjectURL(file);
}

function normalizeImageGeneration(
  item: Partial<SavedImageGeneration>
): SavedImageGeneration {
  return {
    id:
      item.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`),
    kind: (item.kind as ImageToolKey) ?? "text-to-image",
    provider: (item.provider as ImageProvider) ?? "google",
    prompt: item.prompt ?? "",
    model: item.model ?? "",
    aspect: item.aspect ?? "16:9",
    outputFormat: item.outputFormat ?? "PNG",
    amountRequest: item.amountRequest ?? 1,
    createdAt: item.createdAt ?? new Date().toISOString(),
    status: (item.status as SavedImageGenerationStatus) ?? "processing",
    imageUrl: item.imageUrl ?? null,
    mimeType: item.mimeType ?? null,
    note: item.note ?? null,
    error: item.error ?? null,
    referenceCount: item.referenceCount ?? 0,
    chargedCredits:
      typeof item.chargedCredits === "number" ? item.chargedCredits : 0,
    refundStatus:
      item.refundStatus === "pending" ||
      item.refundStatus === "refunded" ||
      item.refundStatus === "none"
        ? item.refundStatus
        : "none",
    requestKey: item.requestKey ?? "",
  };
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
      <div className="relative h-full min-h-0">{children}</div>
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
          layoutId="image-tab-pill-premium"
          className="absolute inset-0 rounded-2xl border border-white/20 bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
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
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
  onChange,
}: {
  value: ImageProvider;
  onChange: (next: ImageProvider) => void;
}) {
  const options: ImageProvider[] = ["google", "openai", "byteplus"];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
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
            <div className="flex min-h-[108px] flex-col items-start justify-between">
              <div className="w-full">
                <div className="text-sm font-semibold text-white/92">
                  {formatImageProviderName(option)}
                </div>

                {active ? (
                  <div className="mt-2 inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-violet-100">
                    Selected
                  </div>
                ) : null}
              </div>

              <div className="mt-3 text-xs text-white/48">
                {getImageProviderMeta(option)}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

function ModelCardSelector({
  provider,
  activeTool,
  selectedModel,
  onChangeModel,
}: {
  provider: ImageProvider;
  activeTool: ImageToolKey;
  selectedModel: string;
  onChangeModel: (next: string) => void;
}) {
  const options = getProviderModelOptions(provider, activeTool);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const active = option === selectedModel;

        return (
          <motion.button
            key={option}
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={() => onChangeModel(option)}
            className={cn(
              "cursor-pointer rounded-2xl border p-3 text-left transition",
              active
                ? "border-violet-300/25 bg-violet-400/12 shadow-[0_10px_24px_rgba(139,92,246,0.12)]"
                : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/10"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white/92">
                {formatImageModelName(
                  provider,
                  option,
                  provider === "byteplus" ? (option as BytePlusModel) : undefined
                )}
              </div>
              {active ? (
                <div className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-violet-100">
                  Selected
                </div>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-white/48">
              {getImageModelMeta(provider, activeTool, option)}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

function UploadImagesCard({
  title,
  subtitle,
  maxFiles = 4,
  files,
  onChangeFiles,
}: {
  title: string;
  subtitle: string;
  maxFiles?: number;
  files: File[];
  onChangeFiles: (next: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pick = () => inputRef.current?.click();

  const addFiles = (incoming: File[]) => {
    const onlyImages = incoming.filter((f) => f.type.startsWith("image/"));
    const next = [...files, ...onlyImages].slice(0, maxFiles);
    onChangeFiles(next);
  };

  const removeAt = (idx: number) => {
    onChangeFiles(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/22 p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          if (!list.length) return;
          addFiles(list);
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
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/80 transition hover:border-white/20 hover:bg-white/[0.08]"
          title="Add images"
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
          files.map((f, i) => {
            const url = getFilePreviewUrl(f);
            return (
              <div
                key={`${f.name}-${f.size}-${i}`}
                className="group relative h-16 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/30"
              >
                <img
                  src={url}
                  alt={f.name}
                  className="h-full w-full object-cover"
                  draggable={false}
                  onLoad={() => URL.revokeObjectURL(url)}
                />

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

      <div className="mt-3 flex items-center justify-between text-[11px] text-white/40">
        <span>{files.length}/{maxFiles} images</span>
        <span>PNG, JPG, WEBP</span>
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

function ImageHistoryCard({
  item,
  onOpen,
}: {
  item: SavedImageGeneration;
  onOpen: (item: SavedImageGeneration) => void;
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
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.prompt}
            className="h-[320px] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            draggable={false}
          />
        ) : item.status === "failed" ? (
          <div className="flex h-[320px] w-full items-center justify-center bg-gradient-to-br from-red-500/10 to-red-500/5">
            <div className="px-6 text-center text-sm text-red-200/90">
              Generation failed
            </div>
          </div>
        ) : item.status === "processing" ? (
          <div className="flex h-[320px] w-full items-center justify-center bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-10 w-10">
                <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-white/80" />
              </div>
              <div className="text-sm text-white/70">
                {prettyImageStatus(item.status)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-[320px] w-full items-center justify-center bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
            <div className="px-6 text-center text-sm text-white/50">
              Preview not stored locally
            </div>
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
            {prettyImageStatus(item.status)}
          </div>
        </div>

        <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[11px] text-white/70 backdrop-blur">
          <div className="flex items-center gap-1.5">
            <ImageIcon size={11} />
            Image
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="line-clamp-2 text-sm font-medium leading-5 text-white">
            {item.prompt || "Untitled generation"}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/65">
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {formatImageProviderName(item.provider)}
            </div>
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {item.model}
            </div>
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {item.aspect}
            </div>
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {item.outputFormat}
            </div>
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {item.chargedCredits} credits
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default function CreateImageClient({
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

  const tabParam = (searchParams.get("tab") || "") as ImageToolKey | "";
  const [active, setActive] = useState<ImageToolKey>("reference-to-image");

  const [mounted, setMounted] = useState(false);
  const [showTopupPanel, setShowTopupPanel] = useState(false);

  const [refImages, setRefImages] = useState<File[]>([]);
  const [referencePrompt, setReferencePrompt] = useState("");
  const [textPrompt, setTextPrompt] = useState("");

  const [provider, setProvider] = useState<ImageProvider>("google");
  const [selectedModel, setSelectedModel] = useState<string>(GOOGLE_MODEL_VALUE);

  const [aspect, setAspect] = useState<string>("16:9");
  const [outputFormat, setOutputFormat] = useState<string>("PNG");
  const [amount, setAmount] = useState<number>(2);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generations, setGenerations] = useState<SavedImageGeneration[]>([]);
  const [selectedGeneration, setSelectedGeneration] =
    useState<SavedImageGeneration | null>(null);
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

  useEffect(() => {
    const allowed = getProviderModelOptions(provider, active);
    if (!allowed.includes(selectedModel)) {
      setSelectedModel(getDefaultModelForProvider(provider, active));
    }
  }, [provider, active, selectedModel]);

  const byteplusModel =
    provider === "byteplus"
      ? (selectedModel as BytePlusModel)
      : "seedream-5-0-260128";

  const displayModelName = formatImageModelName(
    provider,
    selectedModel,
    provider === "byteplus" ? (selectedModel as BytePlusModel) : undefined
  );

  const effectiveApiModelName =
    provider === "google"
      ? "Nano Banana Pro"
      : provider === "openai"
        ? "GPT Image 1.5"
        : displayModelName;

  const imageCreditCost = useMemo(() => {
    return getImageGenerationCost({
      provider,
      active,
      model: selectedModel,
      amount,
      refCount: refImages.length,
    });
  }, [provider, active, selectedModel, amount, refImages.length]);

  const remainingCreditsAfterCreate =
    effectiveCredits != null ? effectiveCredits - imageCreditCost : null;

  const hasEnoughCredits =
    effectiveCredits != null && effectiveCredits >= imageCreditCost;


  useEffect(() => {
    if (creditsAreResolved && !hasEnoughCredits) {
      setShowTopupPanel(true);
    }
  }, [creditsAreResolved, hasEnoughCredits]);

  const deductCredits = async (
    amountToDeduct: number,
    description: string,
    metadata: Record<string, unknown>
  ) => {
    if (!user) {
      throw new Error("You must be logged in.");
    }

    const { data, error } = await supabase.rpc("deduct_credits_safe", {
      p_user_id: user.id,
      p_amount: amountToDeduct,
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
    amountToRefund: number,
    description: string,
    referenceKey: string,
    metadata: Record<string, unknown>
  ) => {
    if (!user) {
      throw new Error("You must be logged in.");
    }

    const { data, error } = await supabase.rpc("refund_credits_safe", {
      p_user_id: user.id,
      p_amount: amountToRefund,
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadStoredGenerations = async () => {
      try {
        const raw = localStorage.getItem(IMAGE_GENERATIONS_STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as Partial<SavedImageGeneration>[];
        if (!Array.isArray(parsed)) return;

        const hydrated = await Promise.all(
          parsed.map(async (item) => {
            const preview = await loadPreviewFromDb(item.id as string);
            return normalizeImageGeneration({
              ...item,
              imageUrl: item.imageUrl || preview,
            });
          })
        );

        setGenerations(hydrated);
        if (hydrated.length > 0) {
          setSelectedGeneration(hydrated[0]);
        }
      } catch (err) {
        console.error("Failed to load image generations from storage:", err);
      } finally {
        setHasLoadedGenerations(true);
      }
    };

    void loadStoredGenerations();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoadedGenerations) return;

    const persistGenerations = async () => {
      try {
        const latest = generations.slice(0, 20);

        await Promise.all(
          latest.map(async (item) => {
            if (item.imageUrl) {
              await savePreviewToDb(item.id, item.imageUrl);
            }
          })
        );

        const lightweightGenerations = latest.map((item) => ({
          ...item,
          imageUrl: null,
        }));

        localStorage.setItem(
          IMAGE_GENERATIONS_STORAGE_KEY,
          JSON.stringify(lightweightGenerations)
        );
      } catch (err) {
        console.error("Failed to save image generations to storage:", err);
      }
    };

    void persistGenerations();
  }, [generations, hasLoadedGenerations]);

  useEffect(() => {
    const isOnTool =
      tabParam === "reference-to-image" || tabParam === "text-to-image";

    if (!isOnTool) return;
    if (!mounted) return;
    if (authLoading) return;
    if (user) return;

    const redirect = `/create/image?tab=${tabParam}`;
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [tabParam, user, router, mounted, authLoading]);

  useEffect(() => {
    if (tabParam === "reference-to-image" || tabParam === "text-to-image") {
      setActive(tabParam);
    }
  }, [tabParam]);

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
      latestSelected.imageUrl !== selectedGeneration.imageUrl ||
      latestSelected.status !== selectedGeneration.status ||
      latestSelected.error !== selectedGeneration.error ||
      latestSelected.refundStatus !== selectedGeneration.refundStatus ||
      latestSelected.note !== selectedGeneration.note
    ) {
      setSelectedGeneration(latestSelected);
    }
  }, [generations, selectedGeneration]);

  const toolLabel = useMemo(
    () => IMAGE_TOOLS.find((t) => t.key === active)?.label ?? "Create",
    [active]
  );

  const activePrompt =
    active === "reference-to-image" ? referencePrompt : textPrompt;

  const recentGenerations = generations.slice(0, 6);
  const currentTask = generations.find((item) => item.status === "processing");

  const filteredHistory = useMemo(() => {
    return generations.filter((item) => {
      const searchMatch = item.prompt
        .toLowerCase()
        .includes(historySearch.toLowerCase());

      if (!searchMatch) return false;

      if (historyFilter === "all") return true;
      if (historyFilter === "success") return item.status === "success";
      if (historyFilter === "failed") return item.status === "failed";
      if (historyFilter === "processing") return item.status === "processing";
      return true;
    });
  }, [generations, historyFilter, historySearch]);

  const applyPromptPreset = (preset: string) => {
    if (active === "reference-to-image") {
      setReferencePrompt((prev) =>
        prev ? `${prev.trim()}, ${preset}` : preset
      );
    } else {
      setTextPrompt((prev) => (prev ? `${prev.trim()}, ${preset}` : preset));
    }
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

  const goVideoWorkspace = () => {
    router.push("/create/video?tab=reference-to-video");
  };

  const onChangeTool = (k: ImageToolKey) => {
    router.push(`/create/image?tab=${k}`);
  };

  const createImages = async () => {
    const trimmedPrompt = activePrompt.trim();
    let pendingItems: SavedImageGeneration[] = [];

    try {
      setError(null);
      setIsCreating(true);

      if (!user) {
        throw new Error("You must be logged in.");
      }

      if (effectiveCredits != null && effectiveCredits < imageCreditCost) {
        throw new Error(
          `You need ${imageCreditCost} credits, but only have ${effectiveCredits}.`
        );
      }

      if (!trimmedPrompt) {
        throw new Error("Please enter a prompt.");
      }

      if (active === "reference-to-image" && refImages.length === 0) {
        throw new Error("Please upload at least 1 reference image.");
      }

      if (active === "reference-to-image" && refImages.length > 4) {
        throw new Error("You can upload at most 4 reference images.");
      }

      if (
        provider === "byteplus" &&
        active === "reference-to-image" &&
        byteplusModel === "seedream-3-0-t2i-250415"
      ) {
        throw new Error(
          "Seedream 3.0 is text-to-image only. Choose Seedream 4.0, 4.5, or 5.0 for references."
        );
      }

      const totalCredits = imageCreditCost;
      const perItemCredits = totalCredits / amount;

      await deductCredits(
        totalCredits,
        active === "reference-to-image"
          ? "Reference to image generation"
          : "Text to image generation",
        {
          kind: active,
          provider,
          model: effectiveApiModelName,
          rawModel: selectedModel,
          byteplusModel,
          aspect,
          outputFormat,
          amount,
          referenceCount: refImages.length,
        }
      );

      const timestamp = new Date().toISOString();

      pendingItems = Array.from({ length: amount }, (_, index) => {
        const requestKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${index}-${Math.random()}`;

        return {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${index}-${Math.random()}`,
          kind: active,
          provider,
          prompt: trimmedPrompt,
          model: effectiveApiModelName,
          aspect,
          outputFormat,
          amountRequest: amount,
          createdAt: timestamp,
          status: "processing" as const,
          imageUrl: null,
          mimeType: null,
          note: null,
          error: null,
          referenceCount:
            active === "reference-to-image" ? refImages.length : 0,
          chargedCredits: perItemCredits,
          refundStatus: "none" as const,
          requestKey,
        };
      });

      setGenerations((prev) => [...pendingItems, ...prev]);
      setSelectedGeneration(pendingItems[0] ?? null);

      const formData = new FormData();
      formData.append("provider", provider);
      formData.append("mode", active);
      formData.append("prompt", trimmedPrompt);
      formData.append("aspect", aspect);
      formData.append("amount", String(amount));
      formData.append("outputFormat", outputFormat);

      if (provider === "byteplus") {
        formData.append("byteplusModel", byteplusModel);
      }

      if (active === "reference-to-image") {
        refImages.forEach((file) => {
          formData.append("refs", file);
        });
      }

      const res = await fetch("/api/images/generate", {
        method: "POST",
        body: formData,
      });

      const raw = await res.text();
      let data: {
        results?: Array<{
          id?: string;
          imageUrl?: string;
          mimeType?: string;
          text?: string | null;
          createdAt?: string;
        }>;
        error?: string;
      } | null = null;

      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.error || raw || "Image generation failed.");
      }

      const resultItems = data?.results ?? [];

      if (resultItems.length === 0) {
        throw new Error("No images were returned.");
      }

      setGenerations((prev) => {
        const pendingIds = new Set(pendingItems.map((item) => item.id));
        const withoutPending = prev.filter((item) => !pendingIds.has(item.id));

        const completed: SavedImageGeneration[] = pendingItems.map(
          (pendingItem, index) => {
            const result = resultItems[index];

            if (result) {
              return {
                ...pendingItem,
                id: result.id || pendingItem.id,
                createdAt: result.createdAt || pendingItem.createdAt,
                status: "success",
                imageUrl: result.imageUrl || null,
                mimeType: result.mimeType || "image/png",
                note: result.text || null,
                error: null,
                refundStatus: "none",
              };
            }

            return {
              ...pendingItem,
              status: "failed",
              error: "No image was returned for this item.",
              refundStatus: "none",
            };
          }
        );

        if (completed[0]) {
          setSelectedGeneration(completed[0]);
        }

        return [...completed, ...withoutPending];
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";

      setError(message);

      if (pendingItems.length > 0) {
        const totalRefund = pendingItems.reduce(
          (sum, item) => sum + item.chargedCredits,
          0
        );

        try {
          await refundCredits(
            totalRefund,
            "Refund for failed image generation batch",
            `image-batch-refund:${pendingItems.map((i) => i.requestKey).join("|")}`,
            {
              requestKeys: pendingItems.map((i) => i.requestKey),
              kind: active,
              provider,
              model: effectiveApiModelName,
              rawModel: selectedModel,
              aspect,
              outputFormat,
              amountRequest: amount,
              referenceCount: refImages.length,
              chargedCredits: totalRefund,
            }
          );
        } catch (refundErr) {
          console.error("Batch image refund failed:", refundErr);
        }

        setGenerations((prev) =>
          prev.map((item) =>
            pendingItems.some((p) => p.id === item.id)
              ? {
                  ...item,
                  status: "failed",
                  error: message,
                  refundStatus: "refunded",
                }
              : item
          )
        );
      }
    } finally {
      setIsCreating(false);
      await refreshCredits();
    }
  };

  const reusePrompt = (item: SavedImageGeneration) => {
    if (item.kind === "reference-to-image") {
      router.push("/create/image?tab=reference-to-image");
      setReferencePrompt(item.prompt);
    } else {
      router.push("/create/image?tab=text-to-image");
      setTextPrompt(item.prompt);
    }
  };

  const reuseSettings = (item: SavedImageGeneration) => {
    if (item.kind === "reference-to-image") {
      router.push("/create/image?tab=reference-to-image");
    } else {
      router.push("/create/image?tab=text-to-image");
    }

    setAspect(item.aspect);
    setOutputFormat(item.outputFormat);
    setProvider(item.provider);

    if (item.provider === "google") {
      setSelectedModel(GOOGLE_MODEL_VALUE);
    } else if (item.provider === "openai") {
      setSelectedModel(OPENAI_MODEL_VALUE);
    } else {
      const bytePlusMatch =
        BYTEPLUS_MODELS.find((m) => m.label === item.model)?.value ??
        BYTEPLUS_MODELS[0].value;
      setSelectedModel(bytePlusMatch);
    }
  };

  const remixGeneration = (item: SavedImageGeneration) => {
    reuseSettings(item);

    if (item.kind === "reference-to-image") {
      setReferencePrompt(
        `${item.prompt}, remix variation, enhanced composition, premium details`
      );
    } else {
      setTextPrompt(
        `${item.prompt}, remix variation, enhanced composition, premium details`
      );
    }
  };

  const workspaceViewportHeight =
    "h-[calc(100vh-136px)] min-h-[720px] max-h-[980px]";



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
              onClick={goVideoWorkspace}
              icon={<Clapperboard size={16} className="opacity-80" />}
            >
              Switch to AI Video
            </TopbarButton>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CreditsPill
              credits={effectiveCredits}
              loading={!creditsAreResolved && authLoading}
            />

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
          className="mt-5"
        >
          <div
            className={cn(
              "grid gap-5 overflow-hidden lg:grid-cols-[460px_minmax(0,1fr)]",
              workspaceViewportHeight
            )}
          >
            <div className="h-full overflow-hidden">
              <GlassPanel className="h-full overflow-hidden p-4">
                <div className="flex h-full flex-col overflow-hidden">
                  <div className="shrink-0 rounded-[24px] border border-white/10 bg-black/22 p-2">
                    <div className="flex gap-1">
                      {IMAGE_TOOLS.map((t) => (
                        <ToolTab
                          key={t.key}
                          label={t.label}
                          active={active === t.key}
                          onClick={() => onChangeTool(t.key)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="dark-scrollbar mt-4 h-[calc(100%-76px)] overflow-y-auto overscroll-contain pr-1">
                    <div className="space-y-4 pb-4">
                      <div className="rounded-[24px] border border-white/10 bg-black/22 p-4">
                        <SectionTitle icon={<Palette size={14} />} kicker="Provider">
                          AI Provider
                        </SectionTitle>

                        <div className="mt-4">
                          <ProviderCardSelector value={provider} onChange={setProvider} />
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-black/22 p-4">
                        <SectionTitle icon={<Upload size={14} />} kicker="Inputs">
                          Source Material
                        </SectionTitle>

                        <div className="mt-4 space-y-4">
                          {active === "reference-to-image" ? (
                            <UploadImagesCard
                              title="Reference Uploads"
                              subtitle="Upload 1 to 4 reference images"
                              maxFiles={4}
                              files={refImages}
                              onChangeFiles={setRefImages}
                            />
                          ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-white/45">
                              No reference uploads needed for text-to-image.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-black/22 p-4">
                        <SectionTitle icon={<Sparkles size={14} />} kicker="Prompt">
                          Creative Direction
                        </SectionTitle>

                        <textarea
                          value={
                            active === "reference-to-image"
                              ? referencePrompt
                              : textPrompt
                          }
                          onChange={(e) =>
                            active === "reference-to-image"
                              ? setReferencePrompt(e.target.value)
                              : setTextPrompt(e.target.value)
                          }
                          className="mt-4 h-36 w-full resize-none rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/36 outline-none transition focus:border-white/25 focus:bg-black/35"
                          placeholder={
                            active === "reference-to-image"
                              ? "Describe what to generate and what to preserve from the references..."
                              : "Write the full image prompt..."
                          }
                        />

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
                              provider={provider}
                              activeTool={active}
                              selectedModel={selectedModel}
                              onChangeModel={setSelectedModel}
                            />
                          </div>

                          <div>
                            <div className="mb-2 text-sm text-white/70">
                              Output Format
                            </div>
                            <ChipSelector
                              value={outputFormat}
                              onChange={setOutputFormat}
                              options={ALL_FORMAT_OPTIONS.map((value) => ({
                                value,
                                meta:
                                  value === "PNG"
                                    ? "best quality"
                                    : value === "JPG"
                                      ? "smaller size"
                                      : "modern format",
                              }))}
                            />
                          </div>

                          <div>
                            <div className="mb-2 text-sm text-white/70">Aspect Ratio</div>
                            <ChipSelector
                              value={aspect}
                              onChange={setAspect}
                              options={ALL_ASPECT_OPTIONS.map((value) => ({ value }))}
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

                      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,24,0.95),rgba(10,10,14,0.95))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                        <SectionTitle icon={<Coins size={14} />} kicker="Summary">
                          Ready to Generate
                        </SectionTitle>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <StatCard
                            label="Generation cost"
                            value={`${imageCreditCost} credits`}
                          />
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
                            You do not have enough credits for this image generation.
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
                                    Buy one-time credit packs without changing your
                                    subscription. Purchased top-up credits persist through
                                    monthly resets.
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
                          onClick={() => void createImages()}
                          whileTap={{ scale: 0.99 }}
                          disabled={
                            isCreating ||
                            !creditsAreResolved ||
                            !hasEnoughCredits ||
                            authLoading
                          }
                          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Sparkles size={16} />
                          <span>
                            {isCreating
                              ? `Generating ${amount} image${amount > 1 ? "s" : ""}...`
                              : !creditsAreResolved
                                ? "Loading credits..."
                                : !hasEnoughCredits
                                  ? `Insufficient credits • Need ${imageCreditCost}`
                                  : `Create • ${imageCreditCost} credits`}
                          </span>
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassPanel>
            </div>

            <div className="h-full overflow-hidden">
              <GlassPanel className="h-full overflow-hidden p-4">
                <div className="flex h-full flex-col overflow-hidden">
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
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
                        className="mt-4 shrink-0 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {currentTask && (
                    <div className="mt-4 shrink-0 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                            Current Task
                          </div>
                          <div className="mt-1 text-sm text-white/75">
                            {prettyImageStatus(currentTask.status)}
                          </div>
                        </div>
                        <div className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs text-violet-100">
                          {currentTask.model} • {currentTask.aspect} •{" "}
                          {currentTask.outputFormat}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {[
                          { label: "Created", state: true, done: true },
                          { label: "Rendering", state: true, done: false },
                          { label: "Ready", state: false, done: false },
                        ].map((step) => (
                          <div
                            key={step.label}
                            className={cn(
                              "rounded-2xl border px-3 py-3 text-center text-xs transition",
                              step.done
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                : step.state
                                  ? "border-violet-400/20 bg-violet-400/10 text-violet-100"
                                  : "border-white/10 bg-black/20 text-white/45"
                            )}
                          >
                            <div className="mb-1 flex justify-center">
                              {step.done ? (
                                <CheckCircle2 size={14} />
                              ) : step.state ? (
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

                  <div className="dark-scrollbar mt-4 h-[calc(100%-190px)] overflow-y-auto overscroll-contain pr-1">
                    <div className="grid gap-4 xl:grid-cols-[1.28fr_0.72fr]">
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
                                  ? new Date(
                                      selectedGeneration.createdAt
                                    ).toLocaleString()
                                  : "Your generated images will appear here."}
                              </div>
                            </div>

                            {selectedGeneration && (
                              <div
                                className={cn(
                                  "rounded-2xl border px-3 py-2 text-xs",
                                  getStatusBadgeClasses(selectedGeneration.status)
                                )}
                              >
                                {prettyImageStatus(selectedGeneration.status)}
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
                                  {selectedGeneration.imageUrl ? (
                                    <img
                                      src={selectedGeneration.imageUrl}
                                      alt={selectedGeneration.prompt}
                                      className="max-h-[720px] w-full rounded-[24px] border border-white/10 bg-black object-contain"
                                      draggable={false}
                                    />
                                  ) : selectedGeneration.status === "failed" ? (
                                    <div className="flex min-h-[440px] items-center justify-center rounded-[24px] border border-red-500/20 bg-red-500/10 px-6 text-center text-sm text-red-200">
                                      {selectedGeneration.error || "Generation failed."}
                                    </div>
                                  ) : selectedGeneration.status === "processing" ? (
                                    <div className="flex min-h-[440px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03]">
                                      <div className="flex flex-col items-center gap-4">
                                        <div className="relative h-12 w-12">
                                          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                                          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-white/80" />
                                        </div>
                                        <div className="text-center">
                                          <div className="text-sm font-medium text-white/90">
                                            {prettyImageStatus(selectedGeneration.status)}
                                          </div>
                                          <div className="mt-1 text-xs text-white/50">
                                            {selectedGeneration.model || "The model"} is
                                            working on this generation.
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex min-h-[440px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03] px-6 text-center text-sm text-white/50">
                                      Preview not stored locally
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
                                    {formatImageProviderName(selectedGeneration.provider)}
                                  </div>
                                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                                    {selectedGeneration.model}
                                  </div>
                                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                                    {selectedGeneration.aspect}
                                  </div>
                                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                                    {selectedGeneration.outputFormat}
                                  </div>
                                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                                    {selectedGeneration.chargedCredits} credits
                                  </div>
                                  {selectedGeneration.kind === "reference-to-image" && (
                                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                                      {selectedGeneration.referenceCount} refs
                                    </div>
                                  )}
                                  {selectedGeneration.status === "failed" && (
                                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                                      refund: {selectedGeneration.refundStatus}
                                    </div>
                                  )}
                                </div>

                                {selectedGeneration.note && (
                                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-white/60">
                                    {selectedGeneration.note}
                                  </div>
                                )}

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

                                  {selectedGeneration.imageUrl && (
                                    <a
                                      href={selectedGeneration.imageUrl}
                                      download={`koa-image-${selectedGeneration.id}.${selectedGeneration.mimeType?.includes("jpeg") ? "jpg" : selectedGeneration.mimeType?.split("/")[1] || "png"}`}
                                      className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/[0.06]"
                                    >
                                      <Download size={15} />
                                      Download image
                                    </a>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6">
                              <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-100">
                                  <ImageIcon size={20} />
                                </div>

                                <div>
                                  <div className="text-lg font-semibold text-white">
                                    Create premium AI images
                                  </div>
                                  <div className="mt-1 max-w-xl text-sm text-white/55">
                                    Build polished visuals from text prompts or reference
                                    images. Your latest renders appear here.
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {[
                                      "Text to image",
                                      "Reference guided",
                                      "Premium renders",
                                    ].map((pill) => (
                                      <div
                                        key={pill}
                                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70"
                                      >
                                        {pill}
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                                    {[
                                      "/backgrounds/1.jpg",
                                      "/backgrounds/2.jpg",
                                      "/backgrounds/3.jpg",
                                      "/backgrounds/4.jpg",
                                    ].map((src, index) => (
                                      <div
                                        key={`${src}-${index}`}
                                        className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                                      >
                                        <img
                                          src={src}
                                          alt=""
                                          className="h-56 w-full object-cover"
                                          draggable={false}
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
                            <div className="text-sm font-semibold text-white/90">
                              Recent
                            </div>
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
                                  {item.imageUrl ? (
                                    <img
                                      src={item.imageUrl}
                                      alt={item.prompt}
                                      className="h-full w-full object-cover"
                                      draggable={false}
                                    />
                                  ) : item.status === "failed" ? (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/45">
                                      FAIL
                                    </div>
                                  ) : item.status === "processing" ? (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/45">
                                      ...
                                    </div>
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/35">
                                      NO PREVIEW
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

                        {currentTask && (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                              Current Task
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm text-white/60">
                              <div className="h-2 w-2 animate-pulse rounded-full bg-violet-300" />
                              Generating image...
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </GlassPanel>
            </div>
          </div>
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
                  All Generated Images
                </div>
                <div className="mt-1 text-sm text-white/45">
                  Browse, search, and filter your image history
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
                      localStorage.removeItem(IMAGE_GENERATIONS_STORAGE_KEY);
                    } catch {}

                    void clearAllPreviewsFromDb();
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
                    <ImageHistoryCard
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
                  "/backgrounds/1.jpg",
                  "/backgrounds/2.jpg",
                  "/backgrounds/3.jpg",
                  "/backgrounds/4.jpg",
                  "/backgrounds/5.jpg",
                  "/backgrounds/6.jpg",
                  "/backgrounds/7.jpg",
                  "/backgrounds/8.jpg",
                ].map((src, index) => (
                  <div
                    key={`${src}-${index}`}
                    className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/30"
                  >
                    <img
                      src={src}
                      alt=""
                      className="h-[320px] w-full object-cover"
                      draggable={false}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[11px] text-white/60 backdrop-blur">
                      <div className="flex items-center gap-1.5">
                        <ImageIcon size={12} />
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