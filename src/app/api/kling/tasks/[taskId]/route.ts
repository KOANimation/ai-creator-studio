import { NextRequest, NextResponse } from "next/server";
import { getKlingAuthorizationHeader } from "@/app/lib/kling/auth";

const KLING_API_BASE =
  process.env.KLING_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api-singapore.klingai.com";

function safeJsonParse(raw: string) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function pickTaskStatus(data: any): string | null {
  return (
    data?.task_status ??
    data?.status ??
    data?.data?.task_status ??
    data?.data?.status ??
    null
  );
}

function pickTaskId(data: any): string | null {
  return (
    data?.task_id ??
    data?.taskId ??
    data?.data?.task_id ??
    data?.data?.taskId ??
    null
  );
}

function pickVideoUrl(data: any): string | null {
  return (
    data?.video_url ??
    data?.videoUrl ??
    data?.data?.video_url ??
    data?.data?.videoUrl ??
    data?.data?.task_result?.video_url ??
    data?.data?.task_result?.videoUrl ??
    data?.data?.task_result?.videos?.[0]?.url ??
    data?.data?.works?.[0]?.resource?.resource ??
    data?.data?.works?.[0]?.video_url ??
    null
  );
}

function pickCoverUrl(data: any): string | null {
  return (
    data?.cover_url ??
    data?.coverUrl ??
    data?.data?.cover_url ??
    data?.data?.coverUrl ??
    data?.data?.task_result?.cover_url ??
    data?.data?.task_result?.coverUrl ??
    data?.data?.task_result?.videos?.[0]?.cover_url ??
    data?.data?.works?.[0]?.cover_url ??
    null
  );
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await context.params;

    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId." }, { status: 400 });
    }

    const authHeader = getKlingAuthorizationHeader();

    const klingRes = await fetch(`${KLING_API_BASE}/v1/videos/image2video/${taskId}`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
      cache: "no-store",
    });

    const raw = await klingRes.text();
    const data = safeJsonParse(raw);

    if (!klingRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch Kling task status.",
          details: data ?? raw,
        },
        { status: klingRes.status }
      );
    }

    return NextResponse.json({
      ok: true,
      taskId: pickTaskId(data) ?? taskId,
      status: pickTaskStatus(data),
      videoUrl: pickVideoUrl(data),
      coverUrl: pickCoverUrl(data),
      raw: data ?? raw,
    });
  } catch (error) {
    console.error("Kling task route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch Kling task status.",
      },
      { status: 500 }
    );
  }
}