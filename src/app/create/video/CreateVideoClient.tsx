"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

type VideoToolKey = "reference-to-video" | "image-to-video" | "text-to-video";
type GenerationKind =
  | "reference-to-video"
  | "image-to-video"
  | "start-end-to-video"
  | "text-to-video";

type SavedGenerationStatus =
  | "uploading"
  | "created"
  | "queueing"
  | "processing"
  | "success"
  | "failed";

type SavedGeneration = {
  id: string;
  kind: GenerationKind;
  taskId: string;
  prompt: string;
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
};

const VIDEO_TOOLS: { key: VideoToolKey; label: string }[] = [
  { key: "reference-to-video", label: "Reference to Video" },
  { key: "image-to-video", label: "Image to Video" },
  { key: "text-to-video", label: "Text to Video" },
];

const ALL_DURATION_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 1);
const ALL_ASPECT_OPTIONS = ["16:9", "9:16", "1:1", "3:4", "4:3"];
const GENERATIONS_STORAGE_KEY = "koa_video_generations_v1";

function getVideoGenerationCost({
  kind,
  model,
  duration,
  resolution,
  amount,
  refClipCount,
  refImageCount,
}: {
  kind: GenerationKind;
  model: string;
  duration: number;
  resolution: string;
  amount: number;
  refClipCount: number;
  refImageCount: number;
}) {
  let baseCost = 0;

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
      case "viduq1":
      case "viduq1-classic":
        baseCost = 18;
        break;
      case "vidu2.0":
        baseCost = 16;
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
      case "viduq1":
      case "viduq1-classic":
        baseCost = 22;
        break;
      case "vidu2.0":
        baseCost = 20;
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
      case "viduq1":
        baseCost = 15;
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
    referenceExtra += refClipCount * 5;
    referenceExtra += Math.max(0, refImageCount - 1) * 2;
  }

  const perVideoCost =
    baseCost + durationExtra + resolutionExtra + referenceExtra;

  return perVideoCost * amount;
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

function pill(active: boolean) {
  return [
    "rounded-xl border px-3 py-2 text-sm transition",
    active
      ? "border-white/25 bg-white/10 text-white"
      : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20 hover:bg-white/[0.06]",
  ].join(" ");
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-white/90">{children}</div>;
}

function UploadRow({
  title,
  subtitle,
  accept,
  multiple,
  files,
  onAddFiles,
}: {
  title: string;
  subtitle: string;
  accept: string;
  multiple: boolean;
  files: File[];
  onAddFiles: (newFiles: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pick = () => inputRef.current?.click();

  const removeAt = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    onAddFiles(next);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          if (!list.length) return;
          onAddFiles(multiple ? [...files, ...list] : [list[0]]);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-white/55">{subtitle}</div>
        </div>

        <button
          type="button"
          onClick={pick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-lg text-white/80 hover:border-white/20 hover:bg-black/20"
          title="Add"
        >
          +
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {files.length === 0 ? (
          <div className="text-xs text-white/40">No files added yet.</div>
        ) : (
          files.slice(0, 8).map((f, i) => {
            const url = URL.createObjectURL(f);
            const isVideo = f.type.startsWith("video/");
            const isImage = f.type.startsWith("image/");

            return (
              <div
                key={`${f.name}-${f.size}-${i}`}
                className="group relative h-12 w-16 overflow-hidden rounded-xl border border-white/10 bg-black/30"
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
                  className="absolute right-1 top-1 hidden rounded-md border border-white/10 bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 backdrop-blur hover:bg-black/70 group-hover:block"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
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
        className={[
          "group relative overflow-hidden rounded-2xl border bg-black/25",
          has ? "border-white/10" : "border-white/15 border-dashed",
        ].join(" ")}
      >
        {has ? (
          <img
            src={previewUrl}
            alt={label}
            className="h-[120px] w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-[120px] w-full flex-col items-center justify-center">
            <button
              type="button"
              onClick={onPick}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/55 text-xl text-white/85 backdrop-blur hover:border-white/20 hover:bg-black/65"
              title="Upload"
            >
              +
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
                  className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-semibold text-white/85 backdrop-blur hover:border-white/20 hover:bg-black/65"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-semibold text-white/75 backdrop-blur hover:border-white/20 hover:bg-black/65 hover:text-white/85"
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

function getModelOptions(kind: GenerationKind): string[] {
  switch (kind) {
    case "reference-to-video":
      return ["viduq2-pro", "viduq2", "viduq1", "vidu2.0"];
    case "image-to-video":
      return [
        "viduq3-turbo",
        "viduq3-pro",
        "viduq2-pro-fast",
        "viduq2-pro",
        "viduq2-turbo",
        "viduq1",
        "viduq1-classic",
        "vidu2.0",
      ];
    case "start-end-to-video":
      return [
        "viduq3-turbo",
        "viduq3-pro",
        "viduq2-pro-fast",
        "viduq2-pro",
        "viduq2-turbo",
        "viduq1",
        "viduq1-classic",
        "vidu2.0",
      ];
    case "text-to-video":
      return ["viduq3-turbo", "viduq3-pro", "viduq2", "viduq1"];
    default:
      return ["viduq2-pro"];
  }
}

function getAllowedDurations(kind: GenerationKind, model: string): number[] {
  if (kind === "reference-to-video") {
    if (model === "viduq2-pro") return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (model === "viduq2") return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (model === "viduq1") return [5];
    if (model === "vidu2.0") return [4];
    return [5];
  }

  if (kind === "image-to-video") {
    if (model === "viduq3-pro" || model === "viduq3-turbo") {
      return ALL_DURATION_OPTIONS;
    }
    if (
      model === "viduq2-pro" ||
      model === "viduq2-pro-fast" ||
      model === "viduq2-turbo"
    ) {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    }
    if (model === "viduq1" || model === "viduq1-classic") return [5];
    if (model === "vidu2.0") return [4, 8];
    return [5];
  }

  if (kind === "start-end-to-video") {
    if (model === "viduq3-pro" || model === "viduq3-turbo") {
      return ALL_DURATION_OPTIONS;
    }
    if (
      model === "viduq2-pro" ||
      model === "viduq2-pro-fast" ||
      model === "viduq2-turbo"
    ) {
      return [1, 2, 3, 4, 5, 6, 7, 8];
    }
    if (model === "viduq1" || model === "viduq1-classic") return [5];
    if (model === "vidu2.0") return [4, 8];
    return [5];
  }

  if (kind === "text-to-video") {
    if (model === "viduq3-pro" || model === "viduq3-turbo") {
      return ALL_DURATION_OPTIONS;
    }
    if (model === "viduq2") return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (model === "viduq1") return [5];
    return [5];
  }

  return [5];
}

function getAllowedResolutions(
  kind: GenerationKind,
  model: string,
  duration: number
): string[] {
  if (kind === "reference-to-video") {
    if (model === "viduq2-pro" || model === "viduq2") {
      return ["540p", "720p", "1080p"];
    }
    if (model === "viduq1") return ["1080p"];
    if (model === "vidu2.0") return ["360p", "720p"];
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
    if (model === "viduq1" || model === "viduq1-classic") return ["1080p"];
    if (model === "vidu2.0") {
      return duration === 4 ? ["360p", "720p", "1080p"] : ["720p"];
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
    if (model === "viduq1" || model === "viduq1-classic") return ["1080p"];
    if (model === "vidu2.0") {
      return duration === 4 ? ["360p", "720p", "1080p"] : ["720p"];
    }
    return ["720p"];
  }

  if (kind === "text-to-video") {
    if (model === "viduq3-pro" || model === "viduq3-turbo") {
      return ["540p", "720p", "1080p"];
    }
    if (model === "viduq2") return ["540p", "720p", "1080p"];
    if (model === "viduq1") return ["1080p"];
    return ["720p"];
  }

  return ["720p"];
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

function VideoHistoryCard({
  item,
  onOpen,
}: {
  item: SavedGeneration;
  onOpen: (item: SavedGeneration) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group block w-full overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] text-left transition hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="relative overflow-hidden bg-black">
        {item.videoUrl ? (
          <video
            className="h-[320px] w-full object-cover transition duration-300 group-hover:scale-[1.015]"
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
            className="h-[320px] w-full object-cover transition duration-300 group-hover:scale-[1.015]"
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
                <div className="text-sm text-white/70">
                  {prettyStatus(item.status)}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

        <div className="absolute left-3 top-3">
          <div
            className={[
              "rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur",
              getStatusBadgeClasses(item.status),
            ].join(" ")}
          >
            {prettyStatus(item.status)}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="line-clamp-2 text-sm font-medium leading-5 text-white">
            {item.prompt || "Untitled generation"}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/65">
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {item.model}
            </div>
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {item.duration}s
            </div>
            <div className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1">
              {item.aspect}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function CreateVideoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const tabParam = (searchParams.get("tab") || "") as VideoToolKey | "";
  const [active, setActive] = useState<VideoToolKey>("reference-to-video");

  const [mounted, setMounted] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  const [startFrame, setStartFrame] = useState<File | null>(null);
  const [endFrame, setEndFrame] = useState<File | null>(null);
  const [startPreview, setStartPreview] = useState<string | null>(null);
  const [endPreview, setEndPreview] = useState<string | null>(null);
  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);

  const [refClips, setRefClips] = useState<File[]>([]);
  const [refImages, setRefImages] = useState<File[]>([]);

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("viduq2-pro");
  const [resolution, setResolution] = useState("1080p");
  const [duration, setDuration] = useState<number>(5);
  const [amount, setAmount] = useState<number>(2);
  const [aspect, setAspect] = useState<string>("16:9");

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generations, setGenerations] = useState<SavedGeneration[]>([]);
  const [selectedGeneration, setSelectedGeneration] =
    useState<SavedGeneration | null>(null);
  const [hasLoadedGenerations, setHasLoadedGenerations] = useState(false);
  const [refundedFailedTaskIds, setRefundedFailedTaskIds] = useState<string[]>(
    []
  );

  const refreshCredits = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCredits(null);
      return;
    }

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
  };

  useEffect(() => {
    let isActive = true;

    const loadAuthAndCredits = async () => {
      setMounted(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isActive) return;

      setIsAuthed(!!user);
      setAuthChecked(true);

      if (!user) {
        setCredits(null);
        return;
      }

      await refreshCredits();
      if (!isActive) return;
    };

    void loadAuthAndCredits();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isActive) return;

      setIsAuthed(!!session);
      setAuthChecked(true);

      if (!session?.user) {
        setCredits(null);
        return;
      }

      await refreshCredits();
      if (!isActive) return;
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

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

      const parsed = JSON.parse(raw) as SavedGeneration[];
      if (Array.isArray(parsed)) {
        setGenerations(parsed);
        if (parsed.length > 0) {
          setSelectedGeneration(parsed[0]);
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
    if (!authChecked) return;
    if (isAuthed) return;

    const redirect = `/create/video?tab=${tabParam}`;
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [tabParam, isAuthed, router, mounted, authChecked]);

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

  const modelOptions = useMemo(() => getModelOptions(currentKind), [currentKind]);

  const allowedDurations = useMemo(
    () => getAllowedDurations(currentKind, model),
    [currentKind, model]
  );

  const allowedResolutions = useMemo(
    () => getAllowedResolutions(currentKind, model, duration),
    [currentKind, model, duration]
  );

  useEffect(() => {
    if (!modelOptions.includes(model)) {
      setModel(modelOptions[0]);
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

  const videoCreditCost = useMemo(() => {
    return getVideoGenerationCost({
      kind: currentKind,
      model,
      duration,
      resolution,
      amount,
      refClipCount: refClips.length,
      refImageCount: refImages.length,
    });
  }, [
    currentKind,
    model,
    duration,
    resolution,
    amount,
    refClips.length,
    refImages.length,
  ]);

  const remainingCreditsAfterCreate =
    credits != null ? credits - videoCreditCost : null;

  const hasEnoughCredits = credits != null ? credits >= videoCreditCost : true;

  const deductCredits = async (
    description: string,
    metadata: Record<string, unknown>
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in.");
    }

    const { data, error } = await supabase.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: videoCreditCost,
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
    amount: number,
    description: string,
    metadata: Record<string, unknown>
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in.");
    }

    const { data, error } = await supabase.rpc("refund_credits", {
      p_user_id: user.id,
      p_amount: amount,
      p_description: description,
      p_metadata: metadata,
    });

    if (error) {
      throw new Error(error.message || "Failed to refund credits.");
    }

    await refreshCredits();
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setIsAuthed(false);
    setCredits(null);
    router.replace("/tools");
  };

  const onChangeTool = (k: VideoToolKey) =>
    router.push(`/create/video?tab=${k}`);

  const createReferenceToVideo = async () => {
    try {
      setError(null);

      if (credits != null && credits < videoCreditCost) {
        throw new Error(
          `You need ${videoCreditCost} credits, but only have ${credits}.`
        );
      }

      if (!prompt.trim()) {
        throw new Error("Please enter a prompt.");
      }

      if (refClips.length === 0 && refImages.length === 0) {
        throw new Error("Upload at least one reference image or clip.");
      }

      if (refClips.length > 0 && model !== "viduq2-pro") {
        throw new Error("Reference clips are only supported with Vidu Q2 Pro.");
      }

      if (refClips.length > 2) {
        throw new Error("You can upload at most 2 reference clips.");
      }

      if (refImages.length > 7) {
        throw new Error("You can upload at most 7 reference images.");
      }

      if (refClips.length > 0 && refImages.length > 4) {
        throw new Error(
          "With reference clips, upload at most 4 reference images."
        );
      }

      await deductCredits("Reference to video generation", {
        kind: "reference-to-video",
        model,
        duration,
        resolution,
        aspect,
        amount,
        refClipCount: refClips.length,
        refImageCount: refImages.length,
      });

      setIsCreating(true);

      const requests = Array.from({ length: amount }, async () => {
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("model", model);
        formData.append("duration", String(duration));
        formData.append("resolution", resolution);
        formData.append("aspectRatio", aspect);

        refImages.forEach((file) => {
          formData.append("images", file);
        });

        refClips.forEach((file) => {
          formData.append("videos", file);
        });

        const res = await fetch("/api/vidu/reference", {
          method: "POST",
          body: formData,
        });

        const raw = await res.text();
        console.log("Create reference raw response:", raw);

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

      const createdTasks = await Promise.all(requests);
      const timestamp = new Date().toISOString();
      const perItemCredits = videoCreditCost / amount;

      const newGenerations: SavedGeneration[] = createdTasks.map(
        (task, index) => ({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${index}-${Math.random()}`,
          kind: "reference-to-video",
          taskId: task.taskId,
          prompt,
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
        })
      );

      setGenerations((prev) => [...newGenerations, ...prev]);
      setSelectedGeneration(newGenerations[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsCreating(false);
    }
  };

  const createImageOrStartEndVideo = async () => {
    try {
      setError(null);

      if (credits != null && credits < videoCreditCost) {
        throw new Error(
          `You need ${videoCreditCost} credits, but only have ${credits}.`
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

      await deductCredits(
        endFrame ? "Start-end video generation" : "Image to video generation",
        {
          kind: endFrame ? "start-end-to-video" : "image-to-video",
          model,
          duration,
          resolution,
          aspect,
          amount,
        }
      );

      setIsCreating(true);

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
        console.log("Create image/start-end raw response:", raw);

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

      const createdTasks = await Promise.all(requests);
      const timestamp = new Date().toISOString();
      const perItemCredits = videoCreditCost / amount;

      const newGenerations: SavedGeneration[] = createdTasks.map(
        (task, index) => ({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${index}-${Math.random()}`,
          kind: task.kind,
          taskId: task.taskId,
          prompt,
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
        })
      );

      setGenerations((prev) => [...newGenerations, ...prev]);
      setSelectedGeneration(newGenerations[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsCreating(false);
    }
  };

  const createTextToVideo = async () => {
    try {
      setError(null);

      if (credits != null && credits < videoCreditCost) {
        throw new Error(
          `You need ${videoCreditCost} credits, but only have ${credits}.`
        );
      }

      if (!prompt.trim()) {
        throw new Error("Please enter a prompt.");
      }

      await deductCredits("Text to video generation", {
        kind: "text-to-video",
        model,
        duration,
        resolution,
        aspect,
        amount,
      });

      setIsCreating(true);

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
        console.log("Create text raw response:", raw);

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

      const createdTasks = await Promise.all(requests);
      const timestamp = new Date().toISOString();
      const perItemCredits = videoCreditCost / amount;

      const newGenerations: SavedGeneration[] = createdTasks.map(
        (task, index) => ({
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${index}-${Math.random()}`,
          kind: "text-to-video",
          taskId: task.taskId,
          prompt,
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
        })
      );

      setGenerations((prev) => [...newGenerations, ...prev]);
      setSelectedGeneration(newGenerations[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsCreating(false);
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

    const pollOne = async (generationTaskId: string) => {
      const res = await fetch(`/api/vidu/tasks/${generationTaskId}`, {
        method: "GET",
        cache: "no-store",
      });

      const raw = await res.text();
      console.log("Task poll raw response:", raw);

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
        taskId: generationTaskId,
        state: typed?.state ?? null,
        errCode: typed?.err_code ?? null,
        creation: typed?.creations?.[0] ?? null,
      };
    };

    const pollAll = async () => {
      try {
        const results = await Promise.all(
          pendingGenerations.map((item) => pollOne(item.taskId))
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
                error: match.errCode || "Vidu generation failed.",
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
      (item) =>
        item.status === "failed" &&
        !refundedFailedTaskIds.includes(item.taskId)
    );

    if (failedNeedingRefund.length === 0) return;

    let cancelled = false;

    const runRefunds = async () => {
      for (const item of failedNeedingRefund) {
        try {
          const refundAmount = item.chargedCredits;

          await refundCredits(refundAmount, "Refund for failed video generation", {
            taskId: item.taskId,
            kind: item.kind,
            model: item.model,
            duration: item.duration,
            resolution: item.resolution,
            aspect: item.aspect,
            chargedCredits: item.chargedCredits,
          });

          if (!cancelled) {
            setRefundedFailedTaskIds((prev) => [...prev, item.taskId]);
          }
        } catch (err) {
          console.error("Video refund failed:", err);
        }
      }
    };

    void runRefunds();

    return () => {
      cancelled = true;
    };
  }, [generations, refundedFailedTaskIds]);

  useEffect(() => {
    if (!selectedGeneration && generations.length > 0) {
      setSelectedGeneration(generations[0]);
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

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white">
      <WallpaperRevealBackground src="/wallpaper.jpg" radius={240} />

      <div className="relative z-10 mx-auto max-w-[1500px] px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/tools"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]"
            >
              Home
            </Link>
            <button
              onClick={() => router.push("/create/image?tab=text-to-image")}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]"
            >
              Switch to AI Image
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80">
              ⚡ Credits: {credits ?? "..."}
            </div>
            <button className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]">
              API Platform
            </button>
            <button className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]">
              Earn Credits
            </button>
            <button className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]">
              Subscribe
            </button>
            <button className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]">
              🔔
            </button>
            <button
              onClick={() => void logout()}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
          <div className="rounded-3xl border border-white/10 bg-black/16 p-4 backdrop-blur-xl">
            <div className="flex gap-2 rounded-2xl border border-white/10 bg-black/18 p-2 backdrop-blur-xl">
              {VIDEO_TOOLS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => onChangeTool(t.key)}
                  className={pill(active === t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              {active === "reference-to-video" && (
                <>
                  <UploadRow
                    title="Upload Clips / Refs"
                    subtitle="1 clip (8s) / 2 clips (5s each) / references"
                    accept="video/*"
                    multiple={true}
                    files={refClips}
                    onAddFiles={setRefClips}
                  />

                  <UploadRow
                    title="Upload Images / Refs"
                    subtitle="Upload 1-7 images"
                    accept="image/*"
                    multiple={true}
                    files={refImages}
                    onAddFiles={setRefImages}
                  />

                  <div className="rounded-2xl border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
                    <SectionTitle>Prompt</SectionTitle>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="mt-3 h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/25"
                      placeholder="Supports images, videos, or subjects as input..."
                    />
                  </div>
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

                  <div className="rounded-2xl border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        Upload Frames
                      </div>
                      <div className="mt-1 text-xs text-white/55">
                        Upload only Frame 1 for image-to-video, or upload both
                        Frame 1 and Frame 2 for start-end-to-video
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

                  <div className="rounded-2xl border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
                    <SectionTitle>Prompt</SectionTitle>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="mt-3 h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/25"
                      placeholder="Describe motion, camera, lighting, style..."
                    />
                  </div>
                </>
              )}

              {active === "text-to-video" && (
                <div className="rounded-2xl border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
                  <SectionTitle>Prompt</SectionTitle>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="mt-3 h-40 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/25"
                    placeholder="Write the full scene prompt..."
                  />
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <SectionTitle>Model</SectionTitle>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 outline-none focus:border-white/25"
                  >
                    {modelOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4">
                  <SectionTitle>Duration</SectionTitle>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[0, ...ALL_DURATION_OPTIONS].map((d) => {
                      const enabled = allowedDurations.includes(d);

                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => enabled && setDuration(d)}
                          disabled={!enabled}
                          className={[
                            "rounded-xl border px-3 py-2 text-sm",
                            duration === d
                              ? "border-white/25 bg-white/10"
                              : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:bg-black/10",
                            !enabled ? "cursor-not-allowed opacity-30" : "",
                          ].join(" ")}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <SectionTitle>Resolution</SectionTitle>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 outline-none focus:border-white/25"
                  >
                    {allowedResolutions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <SectionTitle>Aspect Ratio</SectionTitle>
                  <select
                    value={aspect}
                    onChange={(e) => setAspect(e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 outline-none focus:border-white/25"
                  >
                    {ALL_ASPECT_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <SectionTitle>Amount</SectionTitle>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAmount(n)}
                        className={[
                          "rounded-xl border px-3 py-2 text-sm",
                          amount === n
                            ? "border-white/25 bg-white/10"
                            : "border-white/10 bg-black/20 text-white/70 hover:border-white/20 hover:bg-black/10",
                        ].join(" ")}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/65">This generation costs</span>
                    <span className="font-semibold text-white">
                      {videoCreditCost} credits
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-white/65">
                      Balance after generation
                    </span>
                    <span
                      className={`font-semibold ${
                        remainingCreditsAfterCreate != null &&
                        remainingCreditsAfterCreate < 0
                          ? "text-red-300"
                          : "text-white"
                      }`}
                    >
                      {remainingCreditsAfterCreate ?? "..."}
                    </span>
                  </div>

                  {!hasEnoughCredits && (
                    <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      You do not have enough credits for this video generation.
                    </div>
                  )}
                </div>

                <button
                  type="button"
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
                  disabled={isCreating || !hasEnoughCredits}
                  className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating
                    ? `Generating ${amount} video${amount > 1 ? "s" : ""}...`
                    : `Create • ${videoCreditCost} credits`}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/16 p-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-white/55">Workspace</div>
                <div className="mt-1 text-lg font-semibold">{toolLabel}</div>
                <div className="mt-1 text-xs text-white/45">
                  Latest result and recent generations
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">
                {mounted ? new Date().toLocaleString() : "—"}
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/18 backdrop-blur-xl">
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
                          : "Your generated videos will appear here."}
                      </div>
                    </div>

                    {selectedGeneration && (
                      <div
                        className={[
                          "rounded-2xl border px-3 py-2 text-xs",
                          getStatusBadgeClasses(selectedGeneration.status),
                        ].join(" ")}
                      >
                        {prettyStatus(selectedGeneration.status)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  {selectedGeneration ? (
                    <>
                      {selectedGeneration.videoUrl ? (
                        <video
                          className="max-h-[680px] w-full rounded-[24px] border border-white/10 bg-black object-contain"
                          src={selectedGeneration.videoUrl}
                          controls
                          playsInline
                          poster={selectedGeneration.coverUrl ?? undefined}
                        />
                      ) : selectedGeneration.status === "failed" ? (
                        <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-red-500/20 bg-red-500/10 px-6 text-center text-sm text-red-200">
                          {selectedGeneration.error || "Generation failed."}
                        </div>
                      ) : (
                        <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03]">
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
                                Vidu is working on this generation.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                          Prompt
                        </div>
                        <div className="mt-2 text-sm leading-6 text-white/70">
                          {selectedGeneration.prompt}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
                          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5">
                            {selectedGeneration.model}
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
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
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
                            className="h-60 w-full object-cover"
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
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
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
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedGeneration(item)}
                        className={[
                          "flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition",
                          selectedGeneration?.id === item.id
                            ? "border-white/20 bg-white/[0.07]"
                            : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]",
                        ].join(" ")}
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
                          </div>
                        </div>
                      </button>
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
                    <div className="mt-2 break-all text-sm text-white/60">
                      {currentTask.taskId}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-black/16 p-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs text-white/55">History</div>
              <div className="mt-1 text-xl font-semibold text-white">
                All Generated Videos
              </div>
              <div className="mt-1 text-sm text-white/45">
                Scroll down to browse everything you created in a Vidu-like
                gallery
              </div>
            </div>

            {generations.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setGenerations([]);
                  setSelectedGeneration(null);
                  setError(null);
                  setRefundedFailedTaskIds([]);
                  try {
                    localStorage.removeItem(GENERATIONS_STORAGE_KEY);
                  } catch {}
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 hover:border-white/20 hover:bg-white/[0.06]"
              >
                Clear history
              </button>
            )}
          </div>

          {generations.length > 0 ? (
            <div className="mt-5 columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
              {generations.map((item) => (
                <div key={item.id} className="mb-4 break-inside-avoid">
                  <VideoHistoryCard
                    item={item}
                    onOpen={(picked) => setSelectedGeneration(picked)}
                  />
                </div>
              ))}
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}