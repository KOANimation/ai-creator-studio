import { NextRequest, NextResponse } from "next/server";

const VIDU_API_BASE = "https://api.vidu.com/ent/v2";

const ALLOWED_REFERENCE_MODELS = [
  "viduq2-pro",
  "viduq2",
  "viduq1",
  "vidu2.0",
] as const;

const MAX_IMAGE_FILE_BYTES = 50 * 1024 * 1024;
const MAX_HTTP_BODY_BYTES = 20 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 5000;
const MIN_IMAGE_DIMENSION = 128;
const MAX_ASPECT_RATIO = 4;

type AllowedReferenceModel = (typeof ALLOWED_REFERENCE_MODELS)[number];

type SubjectInput = {
  id: string;
  name: string;
};

type SubjectPayload = {
  name: string;
  images: string[];
};

function safeJsonParse<T>(raw: string): T | null {
  try {
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function isSupportedImageType(type: string) {
  return ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(type);
}

function fileToDataUrl(file: File, base64: string) {
  const mimeType = file.type || "image/png";
  return `data:${mimeType};base64,${base64}`;
}

async function toBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

function estimateUtf8Bytes(value: string) {
  return Buffer.byteLength(value, "utf8");
}

async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const type = file.type;

  if (type === "image/png") {
    if (buffer.length < 24) {
      throw new Error("Invalid PNG image.");
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  if (type === "image/jpeg" || type === "image/jpg") {
    let offset = 2;

    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;

      const marker = buffer[offset + 1];
      const blockLength = buffer.readUInt16BE(offset + 2);

      if (
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }

      offset += 2 + blockLength;
    }

    throw new Error("Invalid JPEG image.");
  }

  if (type === "image/webp") {
    if (buffer.length < 30) {
      throw new Error("Invalid WebP image.");
    }

    const riff = buffer.toString("ascii", 0, 4);
    const webp = buffer.toString("ascii", 8, 12);

    if (riff !== "RIFF" || webp !== "WEBP") {
      throw new Error("Invalid WebP image.");
    }

    const chunkHeader = buffer.toString("ascii", 12, 16);

    if (chunkHeader === "VP8 ") {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }

    if (chunkHeader === "VP8L") {
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];

      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    }

    if (chunkHeader === "VP8X") {
      const width =
        1 + buffer.readUIntLE(24, 3);
      const height =
        1 + buffer.readUIntLE(27, 3);
      return { width, height };
    }

    throw new Error("Unsupported WebP image.");
  }

  throw new Error("Unsupported image type.");
}

async function validateImageFile(file: File, label: string) {
  if (!isSupportedImageType(file.type)) {
    throw new Error(
      `${label} has an unsupported format. Use png, jpeg, jpg, or webp.`
    );
  }

  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error(`${label} is too large. Vidu allows images up to 50MB.`);
  }

  const { width, height } = await getImageDimensions(file);

  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    throw new Error(
      `${label} must be at least ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION}px.`
    );
  }

  const ratio = width / height;
  if (ratio > MAX_ASPECT_RATIO || ratio < 1 / MAX_ASPECT_RATIO) {
    throw new Error(
      `${label} aspect ratio must be less extreme than 4:1 or 1:4.`
    );
  }
}

function isAllowedReferenceModel(model: string): model is AllowedReferenceModel {
  return ALLOWED_REFERENCE_MODELS.includes(model as AllowedReferenceModel);
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

    if (!isAllowedReferenceModel(model)) {
      return NextResponse.json(
        {
          error:
            "Invalid model for reference-to-video. Allowed: viduq2-pro, viduq2, viduq1, vidu2.0",
        },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt is too long. Max ${MAX_PROMPT_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const imageFiles = formData
      .getAll("images")
      .filter((item): item is File => item instanceof File && item.size > 0);

    const rawSubjects = String(formData.get("subjects") || "").trim();
    const parsedSubjects =
      safeJsonParse<SubjectInput[]>(rawSubjects) ?? [];

    const subjectsMode = parsedSubjects.length > 0;
    const imagesMode = imageFiles.length > 0;

    if (!subjectsMode && !imagesMode) {
      return NextResponse.json(
        {
          error:
            "Provide either 1-7 reference images or at least 1 named subject.",
        },
        { status: 400 }
      );
    }

    if (subjectsMode && imagesMode) {
      return NextResponse.json(
        {
          error:
            "Use either plain reference images or named subjects in one request, not both.",
        },
        { status: 400 }
      );
    }

    if (subjectsMode && model === "viduq2-pro") {
      return NextResponse.json(
        {
          error:
            "viduq2-pro currently only supports non-subject reference calls. Use viduq2 for subject mode.",
        },
        { status: 400 }
      );
    }

    if (imagesMode) {
      if (imageFiles.length > 7) {
        return NextResponse.json(
          { error: "You can upload at most 7 reference images." },
          { status: 400 }
        );
      }

      for (let i = 0; i < imageFiles.length; i += 1) {
        await validateImageFile(imageFiles[i], `Reference image ${i + 1}`);
      }

      const images = await Promise.all(
        imageFiles.map(async (file) => {
          const base64 = await toBase64(file);
          return fileToDataUrl(file, base64);
        })
      );

      const payload = {
        model,
        prompt,
        duration,
        resolution,
        aspect_ratio: aspectRatio,
        bgm: false,
        images,
      };

      const payloadString = JSON.stringify(payload);
      const payloadBytes = estimateUtf8Bytes(payloadString);

      if (payloadBytes > MAX_HTTP_BODY_BYTES) {
        return NextResponse.json(
          {
            error:
              "The request body is too large. Try fewer or smaller reference images.",
            details: {
              payloadBytes,
              limitBytes: MAX_HTTP_BODY_BYTES,
            },
          },
          { status: 400 }
        );
      }

      const viduRes = await fetch(`${VIDU_API_BASE}/reference2video`, {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: payloadString,
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
    }

    const subjects = parsedSubjects;

    if (subjects.length === 0 || subjects.length > 7) {
      return NextResponse.json(
        {
          error: "Subject mode supports 1 to 7 subjects.",
        },
        { status: 400 }
      );
    }

    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const builtSubjects: SubjectPayload[] = [];
    let totalImages = 0;

    for (const subject of subjects) {
      const id = String(subject.id || "").trim();
      const name = String(subject.name || "").trim();

      if (!id) {
        return NextResponse.json(
          { error: "Each subject must have an id." },
          { status: 400 }
        );
      }

      if (!name) {
        return NextResponse.json(
          { error: "Each subject must have a name." },
          { status: 400 }
        );
      }

      const normalizedName = name.toLowerCase();

      if (seenIds.has(id)) {
        return NextResponse.json(
          { error: `Duplicate subject id: ${id}` },
          { status: 400 }
        );
      }

      if (seenNames.has(normalizedName)) {
        return NextResponse.json(
          { error: `Duplicate subject name: ${name}` },
          { status: 400 }
        );
      }

      seenIds.add(id);
      seenNames.add(normalizedName);

      const subjectFiles = formData
        .getAll(`subjectImages:${id}`)
        .filter((item): item is File => item instanceof File && item.size > 0);

      if (subjectFiles.length === 0) {
        return NextResponse.json(
          { error: `Subject "${name}" must include at least 1 image.` },
          { status: 400 }
        );
      }

      if (subjectFiles.length > 3) {
        return NextResponse.json(
          { error: `Subject "${name}" can include at most 3 images.` },
          { status: 400 }
        );
      }

      for (let i = 0; i < subjectFiles.length; i += 1) {
        await validateImageFile(subjectFiles[i], `Subject "${name}" image ${i + 1}`);
      }

      const subjectImages = await Promise.all(
        subjectFiles.map(async (file) => {
          const base64 = await toBase64(file);
          return fileToDataUrl(file, base64);
        })
      );

      totalImages += subjectImages.length;

      builtSubjects.push({
        name,
        images: subjectImages,
      });
    }

    if (totalImages === 0 || totalImages > 7) {
      return NextResponse.json(
        {
          error: "Subject mode supports a total of 1 to 7 images across all subjects.",
        },
        { status: 400 }
      );
    }

    const payload = {
      model,
      prompt,
      duration,
      resolution,
      aspect_ratio: aspectRatio,
      audio: false,
      subjects: builtSubjects,
    };

    const payloadString = JSON.stringify(payload);
    const payloadBytes = estimateUtf8Bytes(payloadString);

    if (payloadBytes > MAX_HTTP_BODY_BYTES) {
      return NextResponse.json(
        {
          error:
            "The request body is too large. Try fewer or smaller subject images.",
          details: {
            payloadBytes,
            limitBytes: MAX_HTTP_BODY_BYTES,
          },
        },
        { status: 400 }
      );
    }

    const viduRes = await fetch(`${VIDU_API_BASE}/reference2video`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: payloadString,
    });

    const raw = await viduRes.text();
    console.log("VIDU SUBJECT REFERENCE RAW RESPONSE:", raw);

    const data = safeJsonParse(raw);

    if (!viduRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to create subject-based reference-to-video task.",
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