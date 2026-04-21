import type {
  KlingCameraControl,
  KlingDuration,
  KlingImageToVideoRequest,
  KlingMode,
  KlingMultiPromptItem,
  KlingSound,
  KlingWatermarkInfo,
} from "@/app/lib/kling/types";
import { validateKlingImageToVideoRequest } from "@/app/lib/kling/validation";

type BuildKlingPayloadInput = {
  image?: string;
  imageTail?: string;
  prompt?: string;
  negativePrompt?: string;

  multiShot?: boolean;
  shotType?: "intelligence" | "customize";
  multiPrompt?: KlingMultiPromptItem[];

  sound?: boolean;
  cfgScale?: number;
  mode?: KlingMode;
  cameraControl?: KlingCameraControl;
  duration?: number | string;
  watermarkEnabled?: boolean;

  elementList?: Array<{ element_id: number }>;
  callbackUrl?: string;
  externalTaskId?: string;
};

function normalizeDuration(value?: number | string): KlingDuration {
  const normalized = String(value ?? "5") as KlingDuration;
  return normalized;
}

function normalizeSound(value?: boolean): KlingSound {
  return value ? "on" : "off";
}

function normalizeWatermarkInfo(enabled?: boolean): KlingWatermarkInfo | undefined {
  if (typeof enabled !== "boolean") return undefined;
  return { enabled };
}

function trimOrUndefined(value?: string): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function normalizeImageValue(value?: string): string | undefined {
  const next = trimOrUndefined(value);
  return next;
}

export function buildKlingImageToVideoPayload(
  input: BuildKlingPayloadInput
): KlingImageToVideoRequest {
  const multiShot = input.multiShot === true;
  const shotType = multiShot ? input.shotType : undefined;

  const payload: KlingImageToVideoRequest = {
    model_name: "kling-v3",

    image: normalizeImageValue(input.image),
    image_tail: multiShot ? undefined : normalizeImageValue(input.imageTail),

    multi_shot: multiShot,
    shot_type: multiShot ? shotType : undefined,

    prompt:
      multiShot && shotType === "customize"
        ? undefined
        : trimOrUndefined(input.prompt),

    multi_prompt:
      multiShot && shotType === "customize"
        ? input.multiPrompt?.map((item, index) => ({
            index: index + 1,
            prompt: item.prompt.trim(),
            duration: String(item.duration),
          }))
        : undefined,

    negative_prompt: trimOrUndefined(input.negativePrompt),

    element_list: input.elementList?.length ? input.elementList : undefined,

    sound: normalizeSound(input.sound),
    cfg_scale: typeof input.cfgScale === "number" ? input.cfgScale : undefined,
    mode: input.mode ?? "std",

    camera_control: input.cameraControl,
    duration: normalizeDuration(input.duration),

    watermark_info: normalizeWatermarkInfo(input.watermarkEnabled),
    callback_url: trimOrUndefined(input.callbackUrl),
    external_task_id: trimOrUndefined(input.externalTaskId),
  };

  return validateKlingImageToVideoRequest(payload);
}