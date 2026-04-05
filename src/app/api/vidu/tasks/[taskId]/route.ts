import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const apiKey = process.env.VIDU_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing VIDU_API_KEY in environment variables." },
        { status: 500 }
      );
    }

    const { taskId } = await context.params;

    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId." }, { status: 400 });
    }

    const viduRes = await fetch(
      `https://api.vidu.com/ent/v2/tasks/${taskId}/creations`,
      {
        method: "GET",
        headers: {
          Authorization: `Token ${apiKey}`,
        },
        cache: "no-store",
      }
    );

    const raw = await viduRes.text();

    return new NextResponse(raw, {
      status: viduRes.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch task status.",
      },
      { status: 500 }
    );
  }
}