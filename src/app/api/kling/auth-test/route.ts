import { NextResponse } from "next/server";
import { createKlingJwt, getKlingAuthorizationHeader } from "@/app/lib/kling/auth";

export async function GET() {
  try {
    const token = createKlingJwt();
    const authorization = getKlingAuthorizationHeader();

    return NextResponse.json({
      ok: true,
      token,
      authorization,
      tokenPreview: `${token.slice(0, 24)}...`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to generate Kling JWT.",
      },
      { status: 500 }
    );
  }
}