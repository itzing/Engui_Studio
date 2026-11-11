import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { localContentPath } from "@/lib/workspaces/files";
import { type MediaRef, limits, fail, parse } from "./core";
import { buildNormalizedOutputs } from "@/lib/gallery/saveOutput";

export async function resolveMedia(source: MediaRef) {
  const workspaceId = requireWorkspaceId();
  if (source.kind === "gallery_asset") {
    const row = await prisma.galleryAsset.findFirst({
      where: { id: source.assetId, workspaceId, trashed: false, type: "image" },
    });
    if (!row) fail("NOT_FOUND", "Image not found.");
    return {
      url: row.originalUrl,
      expectedHash: row.contentHash,
      provenance: parse(row.generationSnapshot),
      asset: row,
      job: null,
    };
  }
  const job = await prisma.job.findFirst({
    where: {
      id: source.jobId,
      workspaceId,
      type: "image",
      status: "completed",
    },
  });
  if (!job) fail("NOT_FOUND", "Image not found.");
  const output = buildNormalizedOutputs(job).find(
    (o) => o.outputId === source.outputId,
  );
  if (!output) fail("NOT_FOUND", "Image not found.");
  return {
    url: output.url,
    expectedHash: null,
    provenance: parse(job.options).mcpProvenance || {},
    asset: null,
    job,
  };
}
export async function readMedia(source: MediaRef) {
  const resolved = await resolveMedia(source),
    workspaceId = requireWorkspaceId();
  // URLs come only from owned records. No outbound URL fetch or caller path is allowed.
  if (
    /[%\\]/.test(resolved.url) ||
    resolved.url.split("/").some((p) => p === ".." || p === ".")
  )
    fail("MEDIA_UNAVAILABLE", "Invalid image storage path.");
  const local = localContentPath(resolved.url);
  if (!local || resolved.url.startsWith("@local/"))
    fail(
      "MEDIA_UNAVAILABLE",
      "The original is not available in local image storage.",
    );
  const root = await fs.realpath(path.resolve(process.cwd(), "public"));
  let real: string;
  try {
    real = await fs.realpath(local);
  } catch {
    fail("MEDIA_UNAVAILABLE", "Image bytes are unavailable.");
  }
  if (!real.startsWith(root + path.sep))
    fail("MEDIA_UNAVAILABLE", "Image bytes are unavailable.");
  const galleryScope = /\/generations\/gallery\/([^/]+)\//.exec(resolved.url);
  if (galleryScope && galleryScope[1] !== workspaceId)
    fail("NOT_FOUND", "Image not found.");
  const foreign = await prisma.workspaceFile.findFirst({
    where: {
      location: resolved.url,
      storageTarget: "local",
      workspaceId: { not: workspaceId },
    },
  });
  if (foreign) fail("NOT_FOUND", "Image not found.");
  const handle = await fs.open(real, "r");
  let bytes: Buffer;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limits().maxImageBytes)
      fail("MEDIA_UNAVAILABLE", "Image exceeds the 25 MiB limit.");
    const bounded = Buffer.alloc(
      Math.min(stat.size + 1, limits().maxImageBytes + 1),
    );
    let total = 0;
    while (total < bounded.length) {
      const read = await handle.read(
        bounded,
        total,
        bounded.length - total,
        null,
      );
      if (!read.bytesRead) break;
      total += read.bytesRead;
    }
    bytes = bounded.subarray(0, total);
  } finally {
    await handle.close();
  }
  if (bytes.length > limits().maxImageBytes)
    fail("MEDIA_UNAVAILABLE", "Image exceeds the 25 MiB limit.");
  let meta: sharp.Metadata;
  try {
    const decoder = sharp(bytes, { limitInputPixels: limits().maxImagePixels });
    meta = await decoder.metadata();
    await decoder.stats();
  } catch {
    fail(
      "MEDIA_UNAVAILABLE",
      "Image cannot be decoded within the pixel limit.",
    );
  }
  if (
    !meta.width ||
    !meta.height ||
    !["png", "jpeg", "webp"].includes(meta.format || "") ||
    (meta.pages || 1) > 1
  )
    fail(
      "MEDIA_UNAVAILABLE",
      "Only static PNG, JPEG and WebP originals are supported.",
    );
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (resolved.expectedHash && resolved.expectedHash !== hash)
    fail("MEDIA_UNAVAILABLE", "Original image integrity check failed.");
  return {
    ...resolved,
    bytes,
    hash,
    width: meta.width,
    height: meta.height,
    mime: meta.format === "jpeg" ? "image/jpeg" : `image/${meta.format}`,
  };
}
export async function imagePreview(source: MediaRef, maxEdge: number) {
  const image = await readMedia(source);
  const preview = await sharp(image.bytes, {
    limitInputPixels: limits().maxImagePixels,
  })
    .rotate()
    .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  if (preview.data.length > limits().maxPreviewBytes)
    fail("MEDIA_UNAVAILABLE", "Preview exceeds the encoded size limit.");
  return {
    metadata: {
      source,
      originalWidth: image.width,
      originalHeight: image.height,
      sha256: image.hash,
      mimeType: "image/webp",
      width: preview.info.width,
      height: preview.info.height,
      byteLength: preview.data.length,
    },
    content: {
      type: "image" as const,
      data: preview.data.toString("base64"),
      mimeType: "image/webp",
    },
  };
}
