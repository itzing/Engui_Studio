import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { registerWorkspaceFile } from "@/lib/workspaces/files";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { queueGalleryEnrichment } from "@/lib/galleryEnrichment";
import { queueGalleryDerivatives } from "@/lib/galleryDerivatives";

function parseJobOptions(rawOptions: unknown): Record<string, unknown> {
  if (!rawOptions) return {};
  if (typeof rawOptions === "string") {
    try {
      const parsed = JSON.parse(rawOptions);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof rawOptions === "object"
    ? (rawOptions as Record<string, unknown>)
    : {};
}

function normalizeUrlCandidate(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function buildNormalizedOutputs(job: any) {
  const options = parseJobOptions(job.options);
  const mediaType =
    job.type === "video"
      ? "video"
      : job.type === "audio" || job.type === "tts" || job.type === "music"
        ? "audio"
        : "image";

  const directCandidates = [
    normalizeUrlCandidate(job.resultUrl),
    normalizeUrlCandidate(options.url),
    normalizeUrlCandidate(options.resultUrl),
    normalizeUrlCandidate(options.image),
    normalizeUrlCandidate(options.image_url),
    normalizeUrlCandidate(options.image_path),
    normalizeUrlCandidate(options.video),
    normalizeUrlCandidate(options.video_url),
    normalizeUrlCandidate(options.video_path),
    normalizeUrlCandidate(options.audioUrl),
    normalizeUrlCandidate(options.output_path),
    normalizeUrlCandidate(options.s3_path),
  ].filter(Boolean) as string[];

  const listCandidates: string[] = [];
  for (const key of ["images", "videos", "outputs", "resultUrls"] as const) {
    const value = options[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const normalized = normalizeUrlCandidate(item);
        if (normalized) listCandidates.push(normalized);
      }
    }
  }

  const uniqueUrls = Array.from(
    new Set([...directCandidates, ...listCandidates]),
  );
  return uniqueUrls.map((url, index) => ({
    outputId: `output-${index + 1}`,
    type: mediaType,
    url,
    previewUrl: url,
    thumbnailUrl: normalizeUrlCandidate(job.thumbnailUrl),
  }));
}

function resolveLocalPathFromUrl(url: string): string | null {
  if (!url.startsWith("/")) return null;
  const normalized = url.split("?")[0];
  if (normalized.startsWith("/generations/")) {
    return path.join(process.cwd(), "public", normalized.replace(/^\//, ""));
  }
  if (normalized.startsWith("/results/")) {
    return path.join(process.cwd(), "public", normalized.replace(/^\//, ""));
  }
  return null;
}

async function readBytesForUrl(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    return Buffer.from(url.split(",")[1] || "", "base64");
  }

  const localPath = resolveLocalPathFromUrl(url);
  if (localPath && fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch output: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function getExtensionFromUrl(url: string, type: string): string {
  const pathname = url.split("?")[0];
  const ext = path.extname(pathname);
  if (ext) return ext;
  if (type === "video") return ".mp4";
  if (type === "audio") return ".mp3";
  return ".png";
}

function normalizeBucket(
  value: unknown,
): "common" | "draft" | "upscale" | null {
  if (value === "common" || value === "draft" || value === "upscale")
    return value;
  return null;
}

export async function createGalleryMembership(
  data: any,
  db: any = prisma,
  options: { respectTrash?: boolean } = {},
) {
  const workspaceId = requireWorkspaceId();
  const key = data.membershipKey;
  const existing = await db.galleryAsset.findFirst({
    where: {
      workspaceId,
      bucket: data.bucket,
      OR: [
        { membershipKey: key },
        ...(data.sourceJobId && data.sourceOutputId
          ? [
              {
                sourceJobId: data.sourceJobId,
                sourceOutputId: data.sourceOutputId,
              },
            ]
          : []),
      ],
    },
    orderBy: { addedToGalleryAt: "asc" },
  });
  if (existing && (!existing.trashed || options.respectTrash))
    return { asset: existing, alreadySaved: true };
  if (existing?.trashed)
    await db.galleryAsset.updateMany({
      where: {
        workspaceId,
        bucket: data.bucket,
        membershipKey: key,
        trashed: true,
      },
      data: { membershipKey: null },
    });
  try {
    const asset = await db.galleryAsset.create({
      data: { ...data, workspaceId },
    });
    return { asset, alreadySaved: false };
  } catch (error: any) {
    if (error.code === "P2002") {
      const asset = await db.galleryAsset.findFirst({
        where: { workspaceId, bucket: data.bucket, membershipKey: key },
      });
      if (asset) return { asset, alreadySaved: true };
    }
    throw error;
  }
}
export async function saveJobOutput(
  jobId: string,
  outputId: string,
  bucket = "common",
) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, workspaceId: requireWorkspaceId() },
  });
  if (!job) throw Error("Job not found");
  const output = buildNormalizedOutputs(job).find(
    (o) => o.outputId === outputId,
  );
  if (!output) throw Error("Output not found");
  const existing = await prisma.galleryAsset.findFirst({
    where: {
      workspaceId: job.workspaceId,
      sourceJobId: jobId,
      sourceOutputId: outputId,
      bucket,
      trashed: false,
    },
  });
  if (existing) return { asset: existing, alreadySaved: true };
  const bytes = await readBytesForUrl(output.url);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const filename = hash + getExtensionFromUrl(output.url, output.type);
  const dir = path.join(
    process.cwd(),
    "public",
    "generations",
    "gallery",
    job.workspaceId,
  );
  fs.mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, filename);
  await registerWorkspaceFile(outputPath);
  fs.writeFileSync(outputPath, bytes);
  const originalUrl = `/generations/gallery/${job.workspaceId}/${filename}`;
  const data = {
    workspaceId: job.workspaceId,
    membershipKey: `job:${jobId}:${outputId}`,
    type: output.type,
    bucket,
    originKind: "job_output",
    sourceJobId: jobId,
    sourceOutputId: outputId,
    contentHash: hash,
    originalUrl,
    previewUrl: originalUrl,
    thumbnailUrl: output.thumbnailUrl,
    generationSnapshot: JSON.stringify({
      ...parseJobOptions(job.options),
      prompt: job.prompt || null,
      modelId: job.modelId || null,
      endpointId: job.endpointId || null,
      sceneSnapshot: (job as any).sceneSnapshotJson
        ? JSON.parse((job as any).sceneSnapshotJson)
        : null,
      sourcePromptDocumentId: (job as any).sourcePromptDocumentId || null,
      sourcePromptDocumentTitle: (job as any).sourcePromptDocumentTitle || null,
      sourceJobId: job.id,
    }),
    derivativeStatus: "pending",
    enrichmentStatus: "pending",
  };
  const result = await prisma.$transaction((tx) =>
    createGalleryMembership(data, tx),
  );
  if (!result.alreadySaved) {
    queueGalleryDerivatives(result.asset.id);
    queueGalleryEnrichment(result.asset.id);
  }
  return result;
}
