import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Modality, type Part } from "@google/genai";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_MODEL = "gemini-3-pro-image-preview";
const OPENAI_MODEL = "gpt-image-1";
const BYTEPLUS_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";

type Provider = "google" | "openai" | "byteplus";
type Mode = "text-to-image" | "reference-to-image";
type OutputFormat = "png" | "jpeg" | "webp";

type BytePlusModel =
  | "seedream-5-0-260128"
  | "seedream-4-5-251128"
  | "seedream-4-0-250828"
  | "seedream-3-0-t2i-250415";

function mapGoogleAspectRatio(aspect: string) {
  const allowed = new Set(["1:1", "4:3", "16:9", "9:16"]);
  return allowed.has(aspect) ? aspect : "16:9";
}

function mapOpenAISize(
  aspect: string
): "1024x1024" | "1024x1536" | "1536x1024" {
  if (aspect === "1:1") return "1024x1024";
  if (aspect === "9:16") return "1024x1536";
  return "1536x1024";
}

function mapBytePlusSize(aspect: string, model: BytePlusModel): string {
  const highMinModels =
    model === "seedream-5-0-260128" || model === "seedream-4-5-251128";

  if (highMinModels) {
    if (aspect === "1:1") return "1920x1920";
    if (aspect === "9:16") return "1440x2560";
    if (aspect === "4:3") return "2304x1728";
    return "2560x1440";
  }

  if (aspect === "1:1") return "1024x1024";
  if (aspect === "9:16") return "1024x1792";
  if (aspect === "4:3") return "1440x1080";
  return "1280x720";
}

function mapOutputFormat(value: string): OutputFormat {
  const lowered = value.toLowerCase();
  if (lowered === "jpg" || lowered === "jpeg") return "jpeg";
  if (lowered === "webp") return "webp";
  return "png";
}

function mimeFromFormat(format: OutputFormat) {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return "image/png";
}

function inferMimeType(file: File) {
  if (file.type?.startsWith("image/")) return file.type;
  return "image/png";
}

function isBytePlusTextOnlyModel(model: string) {
  return model === "seedream-3-0-t2i-250415";
}

function bytePlusSupportsCustomOutputFormat(model: BytePlusModel) {
  return model === "seedream-5-0-260128";
}

function normalizeProvider(raw: string): Provider {
  if (raw === "openai") return "openai";
  if (raw === "byteplus") return "byteplus";
  return "google";
}

function normalizeMode(raw: string): Mode {
  if (raw === "reference-to-image") return "reference-to-image";
  return "text-to-image";
}

function normalizeBytePlusModel(raw: string): BytePlusModel {
  const allowed: BytePlusModel[] = [
    "seedream-5-0-260128",
    "seedream-4-5-251128",
    "seedream-4-0-250828",
    "seedream-3-0-t2i-250415",
  ];

  return allowed.includes(raw as BytePlusModel)
    ? (raw as BytePlusModel)
    : "seedream-5-0-260128";
}

async function fileToInlinePart(file: File): Promise<Part> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    inlineData: {
      mimeType: inferMimeType(file),
      data: buffer.toString("base64"),
    },
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = inferMimeType(file);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/* =========================
   GOOGLE
========================= */

async function generateSingleGoogleImage({
  ai,
  prompt,
  aspect,
  refs,
}: {
  ai: GoogleGenAI;
  prompt: string;
  aspect: string;
  refs: File[];
}) {
  const parts: Part[] = [{ text: prompt }];

  for (const ref of refs) {
    parts.push(await fileToInlinePart(ref));
  }

  const response = await ai.models.generateContent({
    model: GOOGLE_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      imageConfig: {
        aspectRatio: mapGoogleAspectRatio(aspect),
        imageSize: "2K",
      },
    },
  });

  const partsOut = response.candidates?.[0]?.content?.parts ?? [];

  let imageBase64: string | null = null;
  let mimeType = "image/png";
  let text: string | null = null;

  for (const part of partsOut) {
    if ("text" in part && part.text && !text) {
      text = part.text;
    }

    if ("inlineData" in part && part.inlineData?.data && !imageBase64) {
      imageBase64 = part.inlineData.data;
      mimeType = part.inlineData.mimeType || "image/png";
    }
  }

  if (!imageBase64) {
    throw new Error("No image returned by Google.");
  }

  return { imageBase64, mimeType, text };
}

async function generateWithGoogle({
  prompt,
  aspect,
  amount,
  refs,
}: {
  prompt: string;
  aspect: string;
  amount: number;
  refs: File[];
}) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_API_KEY");

  const ai = new GoogleGenAI({ apiKey });

  const jobs = Array.from({ length: amount }, () =>
    generateSingleGoogleImage({ ai, prompt, aspect, refs })
  );

  const results = await Promise.all(jobs);

  return results.map((r, index) => ({
    id: crypto.randomUUID(),
    index,
    mimeType: r.mimeType,
    imageUrl: `data:${r.mimeType};base64,${r.imageBase64}`,
    text: r.text,
    createdAt: new Date().toISOString(),
  }));
}

/* =========================
   OPENAI
========================= */

async function generateSingleOpenAIText({
  client,
  prompt,
  aspect,
  format,
  model,
}: {
  client: OpenAI;
  prompt: string;
  aspect: string;
  format: OutputFormat;
  model: string;
}) {
  const res = await client.images.generate({
    model,
    prompt,
    size: mapOpenAISize(aspect),
    quality: "high",
    output_format: format,
  });

  const img = res.data?.[0];
  if (!img?.b64_json) {
    throw new Error("No image returned.");
  }

  return {
    imageBase64: img.b64_json,
    mimeType: mimeFromFormat(format),
    text: null,
  };
}

async function generateSingleOpenAIEdit({
  client,
  prompt,
  aspect,
  format,
  refs,
  model,
}: {
  client: OpenAI;
  prompt: string;
  aspect: string;
  format: OutputFormat;
  refs: File[];
  model: string;
}) {
  const res = await client.images.edit({
    model,
    prompt,
    image: refs,
    size: mapOpenAISize(aspect),
    quality: "high",
    output_format: format,
  });

  const img = res.data?.[0];
  if (!img?.b64_json) {
    throw new Error("No edited image returned.");
  }

  return {
    imageBase64: img.b64_json,
    mimeType: mimeFromFormat(format),
    text: null,
  };
}

async function generateWithOpenAI({
  mode,
  prompt,
  aspect,
  amount,
  format,
  refs,
}: {
  mode: Mode;
  prompt: string;
  aspect: string;
  amount: number;
  format: OutputFormat;
  refs: File[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const client = new OpenAI({ apiKey });

  const jobs = Array.from({ length: amount }, () =>
    mode === "reference-to-image"
      ? generateSingleOpenAIEdit({
          client,
          prompt,
          aspect,
          format,
          refs,
          model: OPENAI_MODEL,
        })
      : generateSingleOpenAIText({
          client,
          prompt,
          aspect,
          format,
          model: OPENAI_MODEL,
        })
  );

  const results = await Promise.all(jobs);

  return results.map((r, index) => ({
    id: crypto.randomUUID(),
    index,
    mimeType: r.mimeType,
    imageUrl: `data:${r.mimeType};base64,${r.imageBase64}`,
    text: r.text,
    createdAt: new Date().toISOString(),
  }));
}

/* =========================
   BYTEPLUS
========================= */

function getBytePlusImagePayload(
  img: { b64_json?: string | null; url?: string | null } | undefined,
  model: BytePlusModel,
  requestedFormat: OutputFormat
) {
  const effectiveFormat: OutputFormat = bytePlusSupportsCustomOutputFormat(model)
    ? requestedFormat
    : "jpeg";

  if (img?.b64_json) {
    return {
      imageUrl: `data:${mimeFromFormat(effectiveFormat)};base64,${img.b64_json}`,
      mimeType: mimeFromFormat(effectiveFormat),
    };
  }

  if (img?.url) {
    return {
      imageUrl: img.url,
      mimeType: mimeFromFormat(effectiveFormat),
    };
  }

  throw new Error("No image returned by BytePlus.");
}

async function generateSingleBytePlus({
  client,
  prompt,
  aspect,
  format,
  refs,
  model,
}: {
  client: OpenAI;
  prompt: string;
  aspect: string;
  format: OutputFormat;
  refs: File[];
  model: BytePlusModel;
}) {
  const request: Record<string, unknown> = {
    model,
    prompt,
    size: mapBytePlusSize(aspect, model),
    response_format: "b64_json",
    sequential_image_generation: "disabled",
  };

  if (refs.length > 0) {
    const firstRefDataUrl = await fileToDataUrl(refs[0]);
    request.image = firstRefDataUrl;
  }

  if (bytePlusSupportsCustomOutputFormat(model)) {
    request.output_format = format;
  }

  const res = await client.images.generate(request as any);

  const img = res.data?.[0] as
    | { b64_json?: string | null; url?: string | null }
    | undefined;

  const payload = getBytePlusImagePayload(img, model, format);

  return {
    imageUrl: payload.imageUrl,
    mimeType: payload.mimeType,
    text: null,
  };
}

async function generateWithBytePlus({
  mode,
  prompt,
  aspect,
  amount,
  format,
  refs,
  model,
}: {
  mode: Mode;
  prompt: string;
  aspect: string;
  amount: number;
  format: OutputFormat;
  refs: File[];
  model: BytePlusModel;
}) {
  const apiKey = process.env.BYTEDANCE_API_KEY;
  if (!apiKey) throw new Error("Missing BYTEDANCE_API_KEY");

  if (mode === "reference-to-image" && isBytePlusTextOnlyModel(model)) {
    throw new Error(
      "Seedream 3.0 is text-to-image only. Choose Seedream 4.0, 4.5, or 5.0 for reference-based generation."
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: BYTEPLUS_BASE_URL,
  });

  const jobs = Array.from({ length: amount }, () =>
    generateSingleBytePlus({
      client,
      prompt,
      aspect,
      format,
      refs: mode === "reference-to-image" ? refs : [],
      model,
    })
  );

  const results = await Promise.all(jobs);

  return results.map((r, index) => ({
    id: crypto.randomUUID(),
    index,
    mimeType: r.mimeType,
    imageUrl: r.imageUrl,
    text: r.text,
    createdAt: new Date().toISOString(),
  }));
}

/* =========================
   MAIN ROUTE
========================= */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const provider = normalizeProvider(
      String(formData.get("provider") || "google")
    );
    const mode = normalizeMode(
      String(formData.get("mode") || "text-to-image")
    );
    const prompt = String(formData.get("prompt") || "").trim();
    const aspect = String(formData.get("aspect") || "16:9");
    const format = mapOutputFormat(
      String(formData.get("outputFormat") || "png")
    );
    const byteplusModel = normalizeBytePlusModel(
      String(formData.get("byteplusModel") || "seedream-5-0-260128")
    );

    const amount = Math.max(
      1,
      Math.min(4, Number(formData.get("amount") || 1))
    );

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    const refs: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "refs" && value instanceof File && value.size > 0) {
        refs.push(value);
      }
    }

    if (mode === "reference-to-image" && refs.length === 0) {
      return NextResponse.json(
        { error: "Upload at least 1 reference image." },
        { status: 400 }
      );
    }

    if (refs.length > 4) {
      return NextResponse.json(
        { error: "Max 4 reference images." },
        { status: 400 }
      );
    }

    const results =
      provider === "openai"
        ? await generateWithOpenAI({
            mode,
            prompt,
            aspect,
            amount,
            format,
            refs,
          })
        : provider === "byteplus"
          ? await generateWithBytePlus({
              mode,
              prompt,
              aspect,
              amount,
              format,
              refs,
              model: byteplusModel,
            })
          : await generateWithGoogle({
              prompt,
              aspect,
              amount,
              refs,
            });

    return NextResponse.json({
      ok: true,
      provider,
      model:
        provider === "openai"
          ? OPENAI_MODEL
          : provider === "byteplus"
            ? byteplusModel
            : GOOGLE_MODEL,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}