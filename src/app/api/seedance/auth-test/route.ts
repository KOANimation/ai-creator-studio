// src/app/api/seedance/auth-test/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BYTEPLUS_BASE_URL =
  process.env.BYTEPLUS_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/v3";

export async function GET() {
  const apiKey = process.env.BYTEPLUS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing BYTEPLUS_API_KEY",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    provider: "seedance",
    baseUrl: BYTEPLUS_BASE_URL,
    hasApiKey: true,
  });
}