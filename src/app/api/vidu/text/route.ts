import { NextRequest, NextResponse } from "next/server";

const VIDU_API_BASE = "https://api.vidu.com/ent/v2";

const ALLOWED_TEXT_MODELS = [
  "viduq3-turbo",
  "viduq3-pro",
  "viduq2",
  "viduq1",
] as const;

function safeJsonParse(raw: string) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

    const body = await req.json();

    const prompt = String(body.prompt || "").trim();
    const model = String(body.model || "viduq3-turbo");
    const duration = Number(body.duration || 5);
    const resolution = String(body.resolution || "720p");
    const aspectRatio = String(body.aspectRatio || "16:9");

    if (
      !ALLOWED_TEXT_MODELS.includes(
        model as (typeof ALLOWED_TEXT_MODELS)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid model for text-to-video. Allowed: viduq3-turbo, viduq3-pro, viduq2, viduq1",
        },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    const payload = {
      model,
      prompt,
      duration,
      resolution,
      aspect_ratio: aspectRatio,
    };

    const viduRes = await fetch(`${VIDU_API_BASE}/text2video`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await viduRes.text();
    console.log("VIDU TEXT RAW RESPONSE:", raw);

    const data = safeJsonParse(raw);

    if (!viduRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to create text-to-video task.",
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
    console.error("Text route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create text-to-video task.",
      },
      { status: 500 }
    );
  }
}