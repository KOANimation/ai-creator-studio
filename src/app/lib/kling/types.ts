export type KlingModelName = "kling-v3";

export type KlingShotType = "customize" | "intelligence";
export type KlingSound = "on" | "off";
export type KlingMode = "std" | "pro";

export type KlingDuration =
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15";

export type KlingCameraControlType =
  | "simple"
  | "down_back"
  | "forward_up"
  | "right_turn_forward"
  | "left_turn_forward";

export type KlingCameraSimpleConfig = {
  horizontal?: number;
  vertical?: number;
  pan?: number;
  tilt?: number;
  roll?: number;
  zoom?: number;
};

export type KlingCameraControl =
  | {
      type: "simple";
      config: KlingCameraSimpleConfig;
    }
  | {
      type:
        | "down_back"
        | "forward_up"
        | "right_turn_forward"
        | "left_turn_forward";
      config?: never;
    };

export type KlingMultiPromptItem = {
  index: number;
  prompt: string;
  duration: string;
};

export type KlingElementRef = {
  element_id: number;
};

export type KlingWatermarkInfo = {
  enabled: boolean;
};

export type KlingImageToVideoRequest = {
  model_name: KlingModelName;

  image?: string;
  image_tail?: string;

  multi_shot?: boolean;
  shot_type?: KlingShotType;

  prompt?: string;
  multi_prompt?: KlingMultiPromptItem[];

  negative_prompt?: string;
  element_list?: KlingElementRef[];

  sound?: KlingSound;
  cfg_scale?: number;
  mode?: KlingMode;

  camera_control?: KlingCameraControl;
  duration?: KlingDuration;

  watermark_info?: KlingWatermarkInfo;
  callback_url?: string;
  external_task_id?: string;
};