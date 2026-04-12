import { NextRequest, NextResponse } from "next/server";

const VIDU_API_BASE = "https://api.vidu.com/ent/v2";

const ALLOWED_IMAGE_MODELS = [
  "viduq3-turbo",
  "viduq3-pro",
  "viduq2-pro-fast",
  "viduq2-pro",
  "viduq2-turbo",
  "viduq1",
  "viduq1-classic",
  "vidu2.0",
] as const;

const MAX_IMAGE_FILE_BYTES = 50 * 1024 * 1024;
const MAX_HTTP_BODY_BYTES = 20 * 1024 * 1024;

function safeJsonParse(raw: string) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isSupportedImageType(type: string) {
  return ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(type);
}

function fileToDataUrl(file: File, base64: string) {
  const mimeType = file.type || "image/png";
  return `data:${mimeType};base64,${base64}`;
}

async function toBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

function estimateUtf8Bytes(value: string) {
  return Buffer.byteLength(value, "utf8");
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.VIDU_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing VIDU_API_KEY on server." },
        { status: 500 }
      );
    }

    const formData = await req.formData();

    const prompt = String(formData.get("prompt") || "").trim();
    const model = String(formData.get("model") || "viduq2-pro");
    const duration = Number(formData.get("duration") || 5);
    const resolution = String(formData.get("resolution") || "1080p");
    const startFrame = formData.get("startFrame");

    if (
      !ALLOWED_IMAGE_MODELS.includes(
        model as (typeof ALLOWED_IMAGE_MODELS)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid model for image-to-video. Allowed: viduq3-turbo, viduq3-pro, viduq2-pro-fast, viduq2-pro, viduq2-turbo, viduq1, viduq1-classic, vidu2.0",
        },
        { status: 400 }
      );
    }

    if (!(startFrame instanceof File)) {
      return NextResponse.json(
        { error: "Missing startFrame image." },
        { status: 400 }
      );
    }

    if (!isSupportedImageType(startFrame.type)) {
      return NextResponse.json(
        {
          error:
            "Unsupported startFrame format. Use png, jpeg, jpg, or webp.",
        },
        { status: 400 }
      );
    }

    if (startFrame.size > MAX_IMAGE_FILE_BYTES) {
      return NextResponse.json(
        {
          error: "Start frame is too large. Vidu allows images up to 50MB.",
        },
        { status: 400 }
      );
    }

    const base64 = await toBase64(startFrame);
    const startImageDataUrl = fileToDataUrl(startFrame, base64);

    const payload = {
      model,
      images: [startImageDataUrl],
      prompt,
      duration,
      resolution,
      audio: false,
    };

    const payloadString = JSON.stringify(payload);
    const payloadBytes = estimateUtf8Bytes(payloadString);

    if (payloadBytes > MAX_HTTP_BODY_BYTES) {
      return NextResponse.json(
        {
          error:
            "The request body is too large for Vidu when sending base64 image data. Try a smaller/compressed image.",
          details: {
            payloadBytes,
            limitBytes: MAX_HTTP_BODY_BYTES,
          },
        },
        { status: 400 }
      );
    }

    console.log("IMAGE TO VIDEO REQUEST", {
      model,
      duration,
      resolution,
      audio: false,
      promptLength: prompt.length,
      fileName: startFrame.name,
      fileType: startFrame.type,
      fileSize: startFrame.size,
      payloadBytes,
    });

    const viduRes = await fetch(`${VIDU_API_BASE}/img2video`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: payloadString,
    });

    const raw = await viduRes.text();
    console.log("VIDU IMAGE RAW RESPONSE:", raw);

    const data = safeJsonParse(raw);

    if (!viduRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to create image-to-video task.",
          details: data ?? raw,
        },
        { status: viduRes.status }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "Vidu returned an empty or invalid JSON response.",
          raw,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Image route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create image-to-video task.",
      },
      { status: 500 }
    );
  }
}