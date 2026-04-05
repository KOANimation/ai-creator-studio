import { NextRequest, NextResponse } from "next/server";

const VIDU_API_BASE = "https://api.vidu.com/ent/v2";

const ALLOWED_START_END_MODELS = [
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

async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // very light-weight image size detection for png/jpeg/webp
  const type = file.type;

  if (type === "image/png") {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  if (type === "image/jpeg" || type === "image/jpg") {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const blockLength = buffer.readUInt16BE(offset + 2);

      if (
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }

      offset += 2 + blockLength;
    }
  }

  // fallback for webp / unknown: skip hard validation
  return { width: 1, height: 1 };
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
    const endFrame = formData.get("endFrame");

    if (
      !ALLOWED_START_END_MODELS.includes(
        model as (typeof ALLOWED_START_END_MODELS)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid model for start-end-to-video. Allowed: viduq3-turbo, viduq3-pro, viduq2-pro-fast, viduq2-pro, viduq2-turbo, viduq1, viduq1-classic, vidu2.0",
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

    if (!(endFrame instanceof File)) {
      return NextResponse.json(
        { error: "Missing endFrame image." },
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

    if (!isSupportedImageType(endFrame.type)) {
      return NextResponse.json(
        {
          error:
            "Unsupported endFrame format. Use png, jpeg, jpg, or webp.",
        },
        { status: 400 }
      );
    }

    if (startFrame.size > MAX_IMAGE_FILE_BYTES) {
      return NextResponse.json(
        {
          error:
            "Start frame is too large. Vidu allows images up to 50MB.",
        },
        { status: 400 }
      );
    }

    if (endFrame.size > MAX_IMAGE_FILE_BYTES) {
      return NextResponse.json(
        {
          error:
            "End frame is too large. Vidu allows images up to 50MB.",
        },
        { status: 400 }
      );
    }

    const [startDims, endDims] = await Promise.all([
      getImageDimensions(startFrame),
      getImageDimensions(endFrame),
    ]);

    const startRatio = startDims.width / startDims.height;
    const endRatio = endDims.width / endDims.height;
    const ratioBetween = startRatio / endRatio;

    if (ratioBetween < 0.8 || ratioBetween > 1.25) {
      return NextResponse.json(
        {
          error:
            "Start and end frame aspect ratios are too different. Vidu requires them to be close.",
          details: {
            startWidth: startDims.width,
            startHeight: startDims.height,
            endWidth: endDims.width,
            endHeight: endDims.height,
            ratioBetween,
          },
        },
        { status: 400 }
      );
    }

    const startBase64 = await toBase64(startFrame);
    const endBase64 = await toBase64(endFrame);

    const startImageDataUrl = fileToDataUrl(startFrame, startBase64);
    const endImageDataUrl = fileToDataUrl(endFrame, endBase64);

    const payload = {
      model,
      images: [startImageDataUrl, endImageDataUrl],
      prompt,
      duration,
      resolution,
    };

    const payloadString = JSON.stringify(payload);
    const payloadBytes = estimateUtf8Bytes(payloadString);

    if (payloadBytes > MAX_HTTP_BODY_BYTES) {
      return NextResponse.json(
        {
          error:
            "The request body is too large for Vidu when sending base64 start/end frames. Try smaller/compressed images.",
          details: {
            payloadBytes,
            limitBytes: MAX_HTTP_BODY_BYTES,
          },
        },
        { status: 400 }
      );
    }

    console.log("START-END TO VIDEO REQUEST", {
      model,
      duration,
      resolution,
      promptLength: prompt.length,
      startFileName: startFrame.name,
      startFileSize: startFrame.size,
      endFileName: endFrame.name,
      endFileSize: endFrame.size,
      payloadBytes,
      ratioBetween,
    });

    const viduRes = await fetch(`${VIDU_API_BASE}/start-end2video`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: payloadString,
    });

    const raw = await viduRes.text();
    console.log("VIDU START-END RAW RESPONSE:", raw);

    const data = safeJsonParse(raw);

    if (!viduRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to create start-end-to-video task.",
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
    console.error("Start-end route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create start-end-to-video task.",
      },
      { status: 500 }
    );
  }
}