import { NextRequest, NextResponse } from "next/server";
import { getKlingAuthorizationHeader } from "@/app/lib/kling/auth";
import { buildKlingImageToVideoPayload } from "@/app/lib/kling/payload";

const KLING_API_BASE =
  process.env.KLING_API_BASE_URL?.replace(/\/+$/, "") || "https://api-singapore.klingai.com";

const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;

function safeJsonParse(raw: string) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isSupportedImageType(type: string) {
  return ["image/png", "image/jpeg", "image/jpg"].includes(type);
}

async function fileToRawBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

function normalizeBoolean(value: FormDataEntryValue | null, fallback = false) {
  if (value == null) return fallback;
  return String(value).toLowerCase() === "true";
}

function normalizeString(value: FormDataEntryValue | null) {
  const next = String(value ?? "").trim();
  return next || undefined;
}

function normalizeNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickKlingTaskId(data: any): string | null {
  return (
    data?.task_id ??
    data?.taskId ??
    data?.data?.task_id ??
    data?.data?.taskId ??
    data?.id ??
    null
  );
}

function pickKlingStatus(data: any): string | null {
  return (
    data?.task_status ??
    data?.status ??
    data?.data?.task_status ??
    data?.data?.status ??
    null
  );
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = getKlingAuthorizationHeader();
    const formData = await req.formData();

    const startFrame = formData.get("startFrame");
    const endFrame = formData.get("endFrame");

    console.log("KLING FORM DATA RECEIVED:", {
      hasStartFrame: startFrame instanceof File,
      hasEndFrame: endFrame instanceof File,
      prompt: normalizeString(formData.get("prompt")),
      negativePrompt: normalizeString(formData.get("negativePrompt")),
      duration: normalizeString(formData.get("duration")),
      mode: normalizeString(formData.get("mode")),
      withAudio: normalizeString(formData.get("withAudio")),
      multiShot: normalizeString(formData.get("multiShot")),
      shotType: normalizeString(formData.get("shotType")),
      callbackUrl: normalizeString(formData.get("callbackUrl")),
      externalTaskId: normalizeString(formData.get("externalTaskId")),
    });

    if (!(startFrame instanceof File)) {
      return NextResponse.json(
        { error: "Missing startFrame image." },
        { status: 400 }
      );
    }

    console.log("KLING START FRAME:", {
      name: startFrame.name,
      type: startFrame.type,
      size: startFrame.size,
    });

    if (!isSupportedImageType(startFrame.type)) {
      return NextResponse.json(
        { error: "Unsupported startFrame format. Use png, jpg, or jpeg." },
        { status: 400 }
      );
    }

    if (startFrame.size > MAX_IMAGE_FILE_BYTES) {
      return NextResponse.json(
        { error: "startFrame exceeds Kling's 10MB image limit." },
        { status: 400 }
      );
    }

    if (endFrame instanceof File) {
      console.log("KLING END FRAME:", {
        name: endFrame.name,
        type: endFrame.type,
        size: endFrame.size,
      });

      if (!isSupportedImageType(endFrame.type)) {
        return NextResponse.json(
          { error: "Unsupported endFrame format. Use png, jpg, or jpeg." },
          { status: 400 }
        );
      }

      if (endFrame.size > MAX_IMAGE_FILE_BYTES) {
        return NextResponse.json(
          { error: "endFrame exceeds Kling's 10MB image limit." },
          { status: 400 }
        );
      }
    }

    const multiShot = normalizeBoolean(formData.get("multiShot"), false);
    const shotType = normalizeString(formData.get("shotType")) as
      | "intelligence"
      | "customize"
      | undefined;

    let multiPrompt:
      | Array<{ index: number; prompt: string; duration: string }>
      | undefined;

    const rawMultiPrompt = normalizeString(formData.get("multiPrompt"));
    if (rawMultiPrompt) {
      const parsed = safeJsonParse(rawMultiPrompt);

      if (!Array.isArray(parsed)) {
        return NextResponse.json(
          { error: "multiPrompt must be a JSON array." },
          { status: 400 }
        );
      }

      multiPrompt = parsed.map((item, index) => ({
        index: Number(item?.index ?? index + 1),
        prompt: String(item?.prompt ?? ""),
        duration: String(item?.duration ?? ""),
      }));
    }

    const startFrameBase64 = await fileToRawBase64(startFrame);
    const endFrameBase64 =
      endFrame instanceof File ? await fileToRawBase64(endFrame) : undefined;

    console.log("KLING BASE64 LENGTHS:", {
      startFrameBase64Length: startFrameBase64.length,
      endFrameBase64Length: endFrameBase64?.length ?? 0,
    });

    const payload = buildKlingImageToVideoPayload({
      image: startFrameBase64,
      imageTail: endFrameBase64,
      prompt: normalizeString(formData.get("prompt")),
      negativePrompt: normalizeString(formData.get("negativePrompt")),

      multiShot,
      shotType,
      multiPrompt,

      sound: normalizeBoolean(formData.get("withAudio"), false),
      cfgScale: normalizeNumber(formData.get("cfgScale")),
      mode:
        (normalizeString(formData.get("mode")) as "std" | "pro" | undefined) ??
        "std",
      duration: normalizeString(formData.get("duration")) ?? "5",

      callbackUrl: normalizeString(formData.get("callbackUrl")),
      externalTaskId: normalizeString(formData.get("externalTaskId")),
    });

    const requestUrl = `${KLING_API_BASE}/v1/videos/image2video`;

    console.log("KLING REQUEST URL:", requestUrl);
    console.log("KLING REQUEST PAYLOAD SUMMARY:", {
      model_name: payload.model_name,
      hasImage: !!payload.image,
      hasImageTail: !!payload.image_tail,
      multi_shot: payload.multi_shot,
      shot_type: payload.shot_type,
      hasPrompt: !!payload.prompt,
      multi_prompt_count: payload.multi_prompt?.length ?? 0,
      sound: payload.sound,
      mode: payload.mode,
      duration: payload.duration,
      hasNegativePrompt: !!payload.negative_prompt,
      hasCameraControl: !!payload.camera_control,
      hasWatermarkInfo: !!payload.watermark_info,
      callback_url: payload.callback_url,
      external_task_id: payload.external_task_id,
    });

    const klingRes = await fetch(requestUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const raw = await klingRes.text();
    const data = safeJsonParse(raw);

    console.log("KLING RESPONSE STATUS:", klingRes.status);
    console.log("KLING RESPONSE RAW:", raw);

    if (!klingRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to create Kling image-to-video task.",
          status: klingRes.status,
          details: data ?? raw,
        },
        { status: klingRes.status }
      );
    }

    const taskId = pickKlingTaskId(data);
    const status = pickKlingStatus(data);

    return NextResponse.json({
      ok: true,
      taskId,
      status,
      raw: data ?? raw,
    });
  } catch (error) {
    console.error("Kling image-to-video route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Kling image-to-video task.",
        name: error instanceof Error ? error.name : undefined,
        stack:
          process.env.NODE_ENV !== "production" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}