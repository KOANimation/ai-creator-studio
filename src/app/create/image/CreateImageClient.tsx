"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

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
const IMAGE_GENERATIONS_STORAGE_KEY = "koa_image_generations_v1";

const IMAGE_DB_NAME = "koa-image-db";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE_NAME = "previews";

const BYTEPLUS_MODELS: {
  value: BytePlusModel;
  label: string;
  refCapable: boolean;
}[] = [
  { value: "seedream-5-0-260128", label: "Seedream 5.0", refCapable: true },
  { value: "seedream-4-5-251128", label: "Seedream 4.5", refCapable: true },
  { value: "seedream-4-0-250828", label: "Seedream 4.0", refCapable: true },
  {
    value: "seedream-3-0-t2i-250415",
    label: "Seedream 3.0",
    refCapable: false,
  },
];

function getImageGenerationCost({
  provider,
  active,
  model,
  byteplusModel,
  amount,
  refCount,
}: {
  provider: ImageProvider;
  active: ImageToolKey;
  model: string;
  byteplusModel: BytePlusModel;
  amount: number;
  refCount: number;
}) {
  let perImageCost = 0;

  if (provider === "google") {
    perImageCost = active === "reference-to-image" ? 14 : 10;
  } else if (provider === "openai") {
    perImageCost = active === "reference-to-image" ? 18 : 12;
  } else if (provider === "byteplus") {
    switch (byteplusModel) {
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
    <div className="rounded-2xl border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
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
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-white/55">{subtitle}</div>
        </div>

        <button
          type="button"
          onClick={pick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-lg text-white/80 hover:border-white/20 hover:bg-black/20"
          title="Add images"
        >
          +
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {files.length === 0 ? (
          <div className="text-xs text-white/40">No files added yet.</div>
        ) : (
          files.map((f, i) => {
            const url = getFilePreviewUrl(f);
            return (
              <div
                key={`${f.name}-${f.size}-${i}`}
                className="group relative h-12 w-16 overflow-hidden rounded-xl border border-white/10 bg-black/30"
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

      <div className="mt-3 text-[11px] text-white/40">
        {files.length}/{maxFiles} images
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
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group block w-full overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] text-left transition hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="relative overflow-hidden bg-black">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.prompt}
            className="h-[320px] w-full object-cover transition duration-300 group-hover:scale-[1.015]"
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

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

        <div className="absolute left-3 top-3">
          <div
            className={[
              "rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur",
              getStatusBadgeClasses(item.status),
            ].join(" ")}
          >
            {prettyImageStatus(item.status)}
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
    </button>
  );
}

export default function CreateImageClient({
  initialCredits,
}: {
  initialCredits: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const tabParam = (searchParams.get("tab") || "") as ImageToolKey | "";
  const [active, setActive] = useState<ImageToolKey>("reference-to-image");

  const [mounted, setMounted] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [credits, setCredits] = useState<number | null>(initialCredits);

  const [refImages, setRefImages] = useState<File[]>([]);
  const [referencePrompt, setReferencePrompt] = useState("");
  const [textPrompt, setTextPrompt] = useState("");

  const [provider, setProvider] = useState<ImageProvider>("google");
  const [model, setModel] = useState("Nano Banana Pro");
  const [byteplusModel, setByteplusModel] =
    useState<BytePlusModel>("seedream-5-0-260128");

  const [aspect, setAspect] = useState<string>("16:9");
  const [outputFormat, setOutputFormat] = useState<string>("PNG");
  const [amount, setAmount] = useState<number>(2);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generations, setGenerations] = useState<SavedImageGeneration[]>([]);
  const [selectedGeneration, setSelectedGeneration] =
    useState<SavedImageGeneration | null>(null);
  const [hasLoadedGenerations, setHasLoadedGenerations] = useState(false);

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

  const imageCreditCost = useMemo(() => {
    return getImageGenerationCost({
      provider,
      active,
      model,
      byteplusModel,
      amount,
      refCount: refImages.length,
    });
  }, [provider, active, model, byteplusModel, amount, refImages.length]);

  const remainingCreditsAfterCreate =
    credits != null ? credits - imageCreditCost : null;

  const hasEnoughCredits = credits != null && credits >= imageCreditCost;

  const deductCredits = async (
    amountToDeduct: number,
    description: string,
    metadata: Record<string, unknown>
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

  const buildRefundReferenceKey = (requestKey: string) =>
    `image-refund:${requestKey}`;

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

  useEffect(() => {
    if (provider === "openai") {
      setModel("GPT Image 1.5");
      return;
    }

    if (provider === "byteplus") {
      const picked =
        BYTEPLUS_MODELS.find((item) => item.value === byteplusModel)?.label ??
        "Seedream 5.0";
      setModel(picked);
      return;
    }

    setModel("Nano Banana Pro");
  }, [provider, byteplusModel]);

  useEffect(() => {
    if (
      provider === "byteplus" &&
      active === "reference-to-image" &&
      byteplusModel === "seedream-3-0-t2i-250415"
    ) {
      setByteplusModel("seedream-5-0-260128");
    }
  }, [provider, active, byteplusModel]);

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
    if (!authChecked) return;
    if (isAuthed) return;

    const redirect = `/create/image?tab=${tabParam}`;
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [tabParam, isAuthed, router, mounted, authChecked]);

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

  const toolLabel = useMemo(
    () => IMAGE_TOOLS.find((t) => t.key === active)?.label ?? "Create",
    [active]
  );

  const activePrompt =
    active === "reference-to-image" ? referencePrompt : textPrompt;

  const recentGenerations = generations.slice(0, 6);
  const currentTask = generations.find((item) => item.status === "processing");

  const visibleByteplusModels = useMemo(() => {
    if (active === "reference-to-image") {
      return BYTEPLUS_MODELS.filter((item) => item.refCapable);
    }
    return BYTEPLUS_MODELS;
  }, [active]);

  const logout = async () => {
    await supabase.auth.signOut();
    setIsAuthed(false);
    setCredits(null);
    router.replace("/tools");
  };

  const onChangeTool = (k: ImageToolKey) => {
    router.push(`/create/image?tab=${k}`);
  };

  const createImages = async () => {
    const trimmedPrompt = activePrompt.trim();

    try {
      setError(null);
      setIsCreating(true);

      if (credits != null && credits < imageCreditCost) {
        throw new Error(
          `You need ${imageCreditCost} credits, but only have ${credits}.`
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
          model,
          byteplusModel,
          aspect,
          outputFormat,
          amount,
          referenceCount: refImages.length,
        }
      );

      const timestamp = new Date().toISOString();

      const pendingItems: SavedImageGeneration[] = Array.from(
        { length: amount },
        (_, index) => {
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
            model,
            aspect,
            outputFormat,
            amountRequest: amount,
            createdAt: timestamp,
            status: "processing",
            imageUrl: null,
            mimeType: null,
            note: null,
            error: null,
            referenceCount:
              active === "reference-to-image" ? refImages.length : 0,
            chargedCredits: perItemCredits,
            refundStatus: "none",
            requestKey,
          };
        }
      );

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
              refundStatus: "pending",
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

      setGenerations((prev) =>
        prev.map((item) =>
          item.status === "processing"
            ? {
                ...item,
                status: "failed",
                error: message,
                refundStatus:
                  item.refundStatus === "refunded" ? "refunded" : "pending",
              }
            : item
        )
      );
    } finally {
      setIsCreating(false);
    }
  };

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
            "Refund for failed image generation",
            buildRefundReferenceKey(item.requestKey),
            {
              requestKey: item.requestKey,
              kind: item.kind,
              provider: item.provider,
              model: item.model,
              aspect: item.aspect,
              outputFormat: item.outputFormat,
              amountRequest: item.amountRequest,
              referenceCount: item.referenceCount,
              chargedCredits: item.chargedCredits,
            }
          );

          if (!cancelled) {
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === item.id ? { ...g, refundStatus: "refunded" } : g
              )
            );
          }
        } catch (refundErr) {
          console.error("Image refund failed:", refundErr);
        }
      }
    };

    void runRefunds();

    return () => {
      cancelled = true;
    };
  }, [generations]);

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
              onClick={() => router.push("/create/video?tab=reference-to-video")}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.06]"
            >
              Switch to AI Video
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80">
              ⚡ Credits: {credits == null ? "Loading..." : credits}
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
              {IMAGE_TOOLS.map((t) => (
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
              {active === "reference-to-image" && (
                <>
                  <UploadImagesCard
                    title="Upload Images / Refs"
                    subtitle="Upload 1-4 reference images"
                    maxFiles={4}
                    files={refImages}
                    onChangeFiles={setRefImages}
                  />

                  <div className="rounded-2xl border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
                    <SectionTitle>Prompt</SectionTitle>
                    <textarea
                      value={referencePrompt}
                      onChange={(e) => setReferencePrompt(e.target.value)}
                      className="mt-3 h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/25"
                      placeholder="Describe what to generate and what to keep from the references..."
                    />
                  </div>
                </>
              )}

              {active === "text-to-image" && (
                <div className="rounded-2xl border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
                  <SectionTitle>Prompt</SectionTitle>
                  <textarea
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    className="mt-3 h-40 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/25"
                    placeholder="Write the full image prompt..."
                  />
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-black/18 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <SectionTitle>Provider</SectionTitle>
                  <select
                    value={provider}
                    onChange={(e) =>
                      setProvider(e.target.value as ImageProvider)
                    }
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 outline-none focus:border-white/25"
                  >
                    <option value="google">Google</option>
                    <option value="openai">OpenAI</option>
                    <option value="byteplus">BytePlus</option>
                  </select>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <SectionTitle>Model</SectionTitle>
                  {provider === "byteplus" ? (
                    <select
                      value={byteplusModel}
                      onChange={(e) =>
                        setByteplusModel(e.target.value as BytePlusModel)
                      }
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 outline-none focus:border-white/25"
                    >
                      {visibleByteplusModels.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 outline-none focus:border-white/25"
                    >
                      {provider === "google" ? (
                        <option value="Nano Banana Pro">Nano Banana Pro</option>
                      ) : (
                        <option value="GPT Image 1.5">GPT Image 1.5</option>
                      )}
                    </select>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <SectionTitle>Output Format</SectionTitle>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 outline-none focus:border-white/25"
                  >
                    <option value="PNG">PNG</option>
                    <option value="JPG">JPG</option>
                    <option value="WEBP">WEBP</option>
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
                      {imageCreditCost} credits
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
                      {remainingCreditsAfterCreate ?? "Loading..."}
                    </span>
                  </div>

                  {!hasEnoughCredits && credits != null && (
                    <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      You do not have enough credits for this image generation.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void createImages()}
                  disabled={isCreating || credits == null || !hasEnoughCredits}
                  className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating
                    ? `Generating ${amount} image${amount > 1 ? "s" : ""}...`
                    : `Create • ${imageCreditCost} credits`}
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
                          : "Your generated images will appear here."}
                      </div>
                    </div>

                    {selectedGeneration && (
                      <div
                        className={[
                          "rounded-2xl border px-3 py-2 text-xs",
                          getStatusBadgeClasses(selectedGeneration.status),
                        ].join(" ")}
                      >
                        {prettyImageStatus(selectedGeneration.status)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  {selectedGeneration ? (
                    <>
                      {selectedGeneration.imageUrl ? (
                        <img
                          src={selectedGeneration.imageUrl}
                          alt={selectedGeneration.prompt}
                          className="max-h-[680px] w-full rounded-[24px] border border-white/10 bg-black object-contain"
                          draggable={false}
                        />
                      ) : selectedGeneration.status === "failed" ? (
                        <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-red-500/20 bg-red-500/10 px-6 text-center text-sm text-red-200">
                          {selectedGeneration.error || "Generation failed."}
                        </div>
                      ) : selectedGeneration.status === "processing" ? (
                        <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03]">
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
                        <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03] px-6 text-center text-sm text-white/50">
                          Preview not stored locally
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
                            {selectedGeneration.provider === "openai"
                              ? "OpenAI"
                              : selectedGeneration.provider === "byteplus"
                                ? "BytePlus"
                                : "Google"}
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

                        {selectedGeneration.imageUrl && (
                          <a
                            href={selectedGeneration.imageUrl}
                            download={`koa-image-${selectedGeneration.id}.${selectedGeneration.mimeType?.includes("jpeg") ? "jpg" : selectedGeneration.mimeType?.split("/")[1] || "png"}`}
                            className="mt-4 inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/75 hover:border-white/20 hover:bg-white/[0.06]"
                          >
                            Download image
                          </a>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
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
                            className="h-60 w-full object-cover"
                            draggable={false}
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
                    <div className="mt-2 text-sm text-white/60">
                      Generating image...
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
                All Generated Images
              </div>
              <div className="mt-1 text-sm text-white/45">
                Scroll down to browse everything you created in a premium gallery
              </div>
            </div>

            {generations.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setGenerations([]);
                  setSelectedGeneration(null);
                  setError(null);

                  try {
                    localStorage.removeItem(IMAGE_GENERATIONS_STORAGE_KEY);
                  } catch {}

                  void clearAllPreviewsFromDb();
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
                  <ImageHistoryCard
                    item={item}
                    onOpen={(picked) => setSelectedGeneration(picked)}
                  />
                </div>
              ))}
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}