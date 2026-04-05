import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Aspect = "1:1" | "16:9" | "9:16";
type Quality = "low" | "medium" | "high";
type OutputFormat = "png" | "jpeg" | "webp";
type Background = "opaque" | "transparent";

function aspectToSize(aspect: Aspect): "1024x1024" | "1536x1024" | "1024x1536" {
  switch (aspect) {
    case "16:9":
      return "1536x1024";
    case "9:16":
      return "1024x1536";
    case "1:1":
    default:
      return "1024x1024";
  }
}

function isAspect(x: any): x is Aspect {
  return x === "1:1" || x === "16:9" || x === "9:16";
}
function isQuality(x: any): x is Quality {
  return x === "low" || x === "medium" || x === "high";
}
function isOutputFormat(x: any): x is OutputFormat {
  return x === "png" || x === "jpeg" || x === "webp";
}
function isBackground(x: any): x is Background {
  return x === "opaque" || x === "transparent";
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
    }

    const aspect: Aspect = isAspect(body?.aspect) ? body.aspect : "1:1";
    const quality: Quality = isQuality(body?.quality) ? body.quality : "medium";
    const output_format: OutputFormat = isOutputFormat(body?.output_format)
      ? body.output_format
      : "png";
    const background: Background = isBackground(body?.background)
      ? body.background
      : "opaque";

    const nRaw = Number(body?.n ?? 1);
    const n =
      Number.isFinite(nRaw) && nRaw >= 1 ? Math.min(Math.floor(nRaw), 4) : 1;

    const size = aspectToSize(aspect);

    // Optional: Timeout guard so requests don't hang forever
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 120s

    const result = await client.images.generate(
      {
        model: "gpt-image-1.5",
        prompt: prompt.slice(0, 4000),
        size,
        quality,
        output_format,
        background,
        n,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    // Extract base64 images
    const imagesBase64 = (result.data ?? [])
      .map((d: any) => d?.b64_json)
      .filter((x: any) => typeof x === "string" && x.length > 0) as string[];

    if (imagesBase64.length === 0) {
      return NextResponse.json(
        { error: "No image returned from model" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      type: "image",
      // Return BOTH shapes so frontend can’t break
      imagesBase64,
      imageBase64: imagesBase64[0],
      meta: {
        aspect,
        size,
        quality,
        output_format,
        background,
        n: imagesBase64.length,
        usage: (result as any)?.usage ?? null,
      },
    });
  } catch (err: any) {
    // Better error reporting
    const detail =
      err?.name === "AbortError"
        ? "Request timed out (image generation took too long). Try lower quality or fewer images."
        : err?.message ?? String(err);

    console.error("Image generate error:", err);

    return NextResponse.json(
      { error: "Server error", detail },
      { status: 500 }
    );
  }
}