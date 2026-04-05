import { NextRequest, NextResponse } from "next/server";

const VIDU_API_BASE = "https://api.vidu.com/ent/v2";

const ALLOWED_REFERENCE_MODELS = [
  "viduq2-pro",
  "viduq2",
  "viduq1",
  "vidu2.0",
] as const;

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

function isSupportedVideoType(type: string) {
  return ["video/mp4", "video/avi", "video/quicktime"].includes(type);
}

function fileToDataUrl(file: File, base64: string) {
  const mimeType = file.type || "application/octet-stream";
  return `data:${mimeType};base64,${base64}`;
}

async function toBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
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
    const aspectRatio = String(formData.get("aspectRatio") || "16:9");

    const imageFiles = formData
      .getAll("images")
      .filter((item): item is File => item instanceof File);

    const videoFiles = formData
      .getAll("videos")
      .filter((item): item is File => item instanceof File);

    if (!ALLOWED_REFERENCE_MODELS.includes(model as (typeof ALLOWED_REFERENCE_MODELS)[number])) {
      return NextResponse.json(
        {
          error:
            "Invalid model for reference-to-video. Allowed: viduq2-pro, viduq2, viduq1, vidu2.0",
        },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing prompt." },
        { status: 400 }
      );
    }

    if (imageFiles.length === 0 && videoFiles.length === 0) {
      return NextResponse.json(
        { error: "Upload at least one reference image or clip." },
        { status: 400 }
      );
    }

    if (videoFiles.length > 0 && model !== "viduq2-pro") {
      return NextResponse.json(
        { error: "Reference clips are only supported with viduq2-pro." },
        { status: 400 }
      );
    }

    if (videoFiles.length > 2) {
      return NextResponse.json(
        { error: "You can upload at most 2 reference clips." },
        { status: 400 }
      );
    }

    if (imageFiles.length > 7) {
      return NextResponse.json(
        { error: "You can upload at most 7 reference images." },
        { status: 400 }
      );
    }

    if (videoFiles.length > 0 && imageFiles.length > 4) {
      return NextResponse.json(
        {
          error:
            "When using reference clips, upload at most 4 reference images.",
        },
        { status: 400 }
      );
    }

    for (const file of imageFiles) {
      if (!isSupportedImageType(file.type)) {
        return NextResponse.json(
          {
            error:
              "Unsupported reference image format. Use png, jpeg, jpg, or webp.",
          },
          { status: 400 }
        );
      }
    }

    for (const file of videoFiles) {
      if (!isSupportedVideoType(file.type)) {
        return NextResponse.json(
          {
            error:
              "Unsupported reference video format. Use mp4, avi, or mov.",
          },
          { status: 400 }
        );
      }
    }

    const images = await Promise.all(
      imageFiles.map(async (file) => {
        const base64 = await toBase64(file);
        return fileToDataUrl(file, base64);
      })
    );

    const videos = await Promise.all(
      videoFiles.map(async (file) => {
        const base64 = await toBase64(file);
        return fileToDataUrl(file, base64);
      })
    );

    const payload: {
      model: string;
      prompt: string;
      duration: number;
      resolution: string;
      aspect_ratio: string;
      images?: string[];
      videos?: string[];
    } = {
      model,
      prompt,
      duration,
      resolution,
      aspect_ratio: aspectRatio,
    };

    if (images.length > 0) {
      payload.images = images;
    }

    if (videos.length > 0) {
      payload.videos = videos;
    }

    const viduRes = await fetch(`${VIDU_API_BASE}/reference2video`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await viduRes.text();
    console.log("VIDU REFERENCE RAW RESPONSE:", raw);

    const data = safeJsonParse(raw);

    if (!viduRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to create reference-to-video task.",
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
    console.error("Reference route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create reference-to-video task.",
      },
      { status: 500 }
    );
  }
}