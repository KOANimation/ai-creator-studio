import type {
  KlingCameraControl,
  KlingDuration,
  KlingImageToVideoRequest,
  KlingMultiPromptItem,
  KlingShotType,
} from "@/app/lib/kling/types";

function isBlank(value: string | undefined | null) {
  return !value || !value.trim();
}

function hasDataUrlPrefix(value: string) {
  return value.startsWith("data:");
}

function parseDuration(value: string | undefined): number {
  return Number(value ?? "0");
}

function validateDurationValue(duration?: string) {
  const allowed = new Set([
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
  ]);

  if (!duration) {
    throw new Error("Duration is required.");
  }

  if (!allowed.has(duration)) {
    throw new Error("Duration must be one of 3–15 seconds.");
  }
}

function validatePromptLength(prompt: string | undefined, fieldName: string) {
  if (!prompt) return;
  if (prompt.length > 2500) {
    throw new Error(`${fieldName} cannot exceed 2500 characters.`);
  }
}

function validateCameraControl(cameraControl?: KlingCameraControl) {
  if (!cameraControl) return;

  if (
    cameraControl.type !== "simple" &&
    cameraControl.type !== "down_back" &&
    cameraControl.type !== "forward_up" &&
    cameraControl.type !== "right_turn_forward" &&
    cameraControl.type !== "left_turn_forward"
  ) {
    throw new Error("Invalid camera_control.type.");
  }

  if (cameraControl.type === "simple") {
    if (!cameraControl.config) {
      throw new Error('camera_control.config is required when type is "simple".');
    }

    const values = [
      cameraControl.config.horizontal ?? 0,
      cameraControl.config.vertical ?? 0,
      cameraControl.config.pan ?? 0,
      cameraControl.config.tilt ?? 0,
      cameraControl.config.roll ?? 0,
      cameraControl.config.zoom ?? 0,
    ];

    for (const value of values) {
      if (value < -10 || value > 10) {
        throw new Error(
          "camera_control simple config values must be between -10 and 10."
        );
      }
    }

    const nonZeroCount = values.filter((value) => value !== 0).length;
    if (nonZeroCount > 1) {
      throw new Error(
        'camera_control.config may only have one non-zero direction when type is "simple".'
      );
    }
  }
}

function validateMultiPrompt(
  multiPrompt: KlingMultiPromptItem[] | undefined,
  duration: KlingDuration
) {
  if (!multiPrompt || multiPrompt.length === 0) {
    throw new Error(
      'multi_prompt is required when multi_shot is true and shot_type is "customize".'
    );
  }

  if (multiPrompt.length > 6) {
    throw new Error("multi_prompt supports at most 6 storyboard shots.");
  }

  const totalDuration = parseDuration(duration);
  let sum = 0;

  multiPrompt.forEach((item, idx) => {
    if (item.index !== idx + 1) {
      throw new Error("multi_prompt indexes must start at 1 and be sequential.");
    }

    if (isBlank(item.prompt)) {
      throw new Error(`multi_prompt[${idx}] prompt is required.`);
    }

    if (item.prompt.length > 512) {
      throw new Error(`multi_prompt[${idx}] prompt cannot exceed 512 characters.`);
    }

    const shotDuration = Number(item.duration);
    if (!Number.isInteger(shotDuration) || shotDuration < 1) {
      throw new Error(`multi_prompt[${idx}] duration must be an integer of at least 1.`);
    }

    if (shotDuration > totalDuration) {
      throw new Error(
        `multi_prompt[${idx}] duration cannot exceed the total task duration.`
      );
    }

    sum += shotDuration;
  });

  if (sum !== totalDuration) {
    throw new Error(
      `The sum of multi_prompt durations (${sum}) must equal total duration (${totalDuration}).`
    );
  }
}

export function validateKlingImageToVideoRequest(
  input: KlingImageToVideoRequest
): KlingImageToVideoRequest {
  if (input.model_name !== "kling-v3") {
    throw new Error('Only model_name "kling-v3" is supported in this integration.');
  }

  validateDurationValue(input.duration);

  if (!input.image && !input.image_tail) {
    throw new Error("At least one of image or image_tail must be provided.");
  }

  if (input.image && hasDataUrlPrefix(input.image)) {
    throw new Error(
      "Kling image must be raw base64 or an accessible URL. Do not include a data: prefix."
    );
  }

  if (input.image_tail && hasDataUrlPrefix(input.image_tail)) {
    throw new Error(
      "Kling image_tail must be raw base64 or an accessible URL. Do not include a data: prefix."
    );
  }

  validatePromptLength(input.prompt, "prompt");
  validatePromptLength(input.negative_prompt, "negative_prompt");

  if (input.sound && input.sound !== "on" && input.sound !== "off") {
    throw new Error('sound must be either "on" or "off".');
  }

  if (input.mode && input.mode !== "std" && input.mode !== "pro") {
    throw new Error('mode must be either "std" or "pro".');
  }

  if (
    typeof input.cfg_scale === "number" &&
    (input.cfg_scale < 0 || input.cfg_scale > 1)
  ) {
    throw new Error("cfg_scale must be between 0 and 1.");
  }

  if (input.element_list && input.element_list.length > 3) {
    throw new Error("element_list supports at most 3 reference elements.");
  }

  validateCameraControl(input.camera_control);

  const multiShot = input.multi_shot === true;
  const hasEndFrame = !!input.image_tail;
  const shotType = input.shot_type;

  if (multiShot) {
    if (hasEndFrame) {
      throw new Error("image_tail is not supported when multi_shot is true.");
    }

    if (!shotType) {
      throw new Error(
        'shot_type is required when multi_shot is true. Use "intelligence" or "customize".'
      );
    }

    if (shotType !== "intelligence" && shotType !== "customize") {
      throw new Error('shot_type must be either "intelligence" or "customize".');
    }

    if (shotType === "intelligence") {
      if (isBlank(input.prompt)) {
        throw new Error(
          'prompt is required when multi_shot is true and shot_type is "intelligence".'
        );
      }

      if (input.multi_prompt && input.multi_prompt.length > 0) {
        throw new Error(
          'multi_prompt must not be provided when shot_type is "intelligence".'
        );
      }
    }

    if (shotType === "customize") {
      if (!isBlank(input.prompt)) {
        throw new Error(
          'prompt must be empty when multi_shot is true and shot_type is "customize".'
        );
      }

      validateMultiPrompt(input.multi_prompt, input.duration!);
    }
  } else {
    if (input.shot_type) {
      throw new Error("shot_type is invalid when multi_shot is false.");
    }

    if (input.multi_prompt && input.multi_prompt.length > 0) {
      throw new Error("multi_prompt is invalid when multi_shot is false.");
    }

    if (isBlank(input.prompt)) {
      throw new Error("prompt is required when multi_shot is false.");
    }
  }

  return input;
}