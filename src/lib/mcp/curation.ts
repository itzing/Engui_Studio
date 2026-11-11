import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { registerWorkspaceFile } from "@/lib/workspaces/files";
import { createGalleryMembership } from "@/lib/gallery/saveOutput";
import { type MediaRef, fail, findReceipt, parse, receipt } from "./core";
import { readMedia } from "./media";
import { characterSnapshot } from "./catalog";
import { loadPlan, validatePlan } from "./plans";
export async function prepareSavedImage(source: MediaRef, bucket: string) {
  const image = await readMedia(source),
    workspaceId = requireWorkspaceId();
  const ext =
    image.mime === "image/jpeg"
      ? "jpg"
      : image.mime === "image/webp"
        ? "webp"
        : "png";
  const url = `/generations/gallery/${workspaceId}/${image.hash}.${ext}`,
    file = path.join(process.cwd(), "public", url);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await registerWorkspaceFile(file);
  await fs.writeFile(file, image.bytes, { flag: "wx" }).catch((e) => {
    if (e.code !== "EEXIST") throw e;
  });
  const jobId = image.job?.id || image.asset?.sourceJobId || null;
  const outputId =
    source.kind === "job_output"
      ? source.outputId
      : image.asset?.sourceOutputId || null;
  const membershipKey =
    jobId && outputId ? `job:${jobId}:${outputId}` : `asset:${image.asset!.id}`;
  const provenance = image.job
    ? parse(image.job.options).mcpProvenance || {}
    : image.provenance;
  const variant = provenance.snapshot?.variants?.[provenance.variantIndex];
  const generationSnapshot = variant
    ? {
        ...provenance,
        ...variant.settings,
        modelId: provenance.snapshot.draft.modelId,
        prompt: variant.prompt,
        resolvedPrompt: variant.prompt,
        negativePrompt: variant.negativePrompt,
      }
    : provenance;
  return {
    workspaceId,
    membershipKey,
    type: "image",
    bucket,
    originKind: "job_output",
    sourceJobId: jobId,
    sourceOutputId: outputId,
    contentHash: image.hash,
    originalUrl: url,
    previewUrl: url,
    generationSnapshot: JSON.stringify(generationSnapshot),
    derivativeStatus: "pending",
    enrichmentStatus: "skipped",
  };
}
export async function saveOutput(args: {
  source: MediaRef;
  bucket: string;
  requestKey: string;
}) {
  const prior = await findReceipt("save", args.requestKey, args);
  if (prior) return prior;
  if (args.source.kind === "gallery_asset") {
    const existing = await prisma.galleryAsset.findFirst({
      where: {
        id: args.source.assetId,
        bucket: args.bucket,
        trashed: false,
        type: "image",
      },
    });
    if (existing)
      return receipt("save", args.requestKey, args, async () => ({
        assetId: existing.id,
        sha256: existing.contentHash,
        bucket: existing.bucket,
        alreadySaved: true,
      }));
  }
  const data = await prepareSavedImage(args.source, args.bucket);
  return receipt("save", args.requestKey, args, async (tx) => {
    const result = await createGalleryMembership(data, tx);
    return {
      assetId: result.asset.id,
      sha256: result.asset.contentHash,
      bucket: result.asset.bucket,
      alreadySaved: result.alreadySaved,
    };
  });
}
export async function preserveVariant(variant: any) {
  if (variant.assetId) return;
  const source: MediaRef = {
    kind: "job_output",
    jobId: variant.jobId,
    outputId: "output-1",
  };
  const data = await prepareSavedImage(source, "draft");
  await prisma.$transaction(async (tx) => {
    const result = await createGalleryMembership(data, tx, {
      respectTrash: true,
    });
    await tx.mcpGenerationVariant.update({
      where: { id: variant.id },
      data: {
        assetId: result.asset.id,
        preservationState: result.asset.trashed ? "trashed" : "saved",
      },
    });
  });
}
export async function recordReview(args: any) {
  const prior = await findReceipt("review", args.requestKey, args);
  if (prior) return prior;
  await characterSnapshot(args.characterId);
  const asset = await prisma.galleryAsset.findFirst({
    where: { id: args.assetId, trashed: false, type: "image" },
  });
  if (!asset) fail("NOT_FOUND", "Image not found.");
  const metadata = parse(asset.generationSnapshot);
  let snapshot = metadata.snapshot;
  // Trust only the server's persisted association, not gallery-supplied metadata.
  const variant = await prisma.mcpGenerationVariant.findFirst({
    where: {
      OR: [
        { assetId: asset.id },
        ...(asset.sourceJobId ? [{ jobId: asset.sourceJobId }] : []),
      ],
    },
    include: { batch: { include: { plan: true } } },
  });
  if (variant) {
    if (variant.assetId && variant.assetId !== asset.id) {
      const original = await prisma.galleryAsset.findFirst({
        where: { id: variant.assetId },
      });
      if (!original || original.contentHash !== asset.contentHash)
        fail(
          "SNAPSHOT_ASSOCIATION_REQUIRED",
          "Image bytes do not match the generated concept.",
        );
    }
    snapshot = parse(variant.batch.plan.snapshotJson);
    if (snapshot.draft.characterId !== args.characterId)
      fail(
        "SNAPSHOT_ASSOCIATION_REQUIRED",
        "Image belongs to a different character snapshot.",
      );
  } else {
    if (!args.snapshotPlanId)
      fail(
        "SNAPSHOT_ASSOCIATION_REQUIRED",
        "Select a prepared plan referencing this asset.",
      );
    const p = await loadPlan(args.snapshotPlanId);
    await validatePlan(p);
    if (
      p.snapshot.draft.characterId !== args.characterId ||
      !p.snapshot.draft.references.some(
        (ref: MediaRef) =>
          ref.kind === "gallery_asset" && ref.assetId === asset.id,
      )
    )
      fail(
        "SNAPSHOT_ASSOCIATION_REQUIRED",
        "Plan must explicitly reference this character and asset.",
      );
    snapshot = p.snapshot;
  }
  return receipt("review", args.requestKey, args, async (tx) => {
    if (
      !(await tx.character.findFirst({
        where: { id: args.characterId, deletedAt: null },
      })) ||
      !(await tx.galleryAsset.findFirst({
        where: { id: args.assetId, trashed: false },
      }))
    )
      fail("NOT_FOUND", "Character or image is unavailable.");
    let current = await tx.characterConceptReference.findFirst({
      where: { characterId: args.characterId },
    });
    if ((current?.revision || 0) !== args.expectedRevision)
      fail(
        "REVISION_CONFLICT",
        "The approved reference changed. Read the latest revision.",
      );
    const revision =
      args.decision === "approved"
        ? args.expectedRevision + 1
        : args.expectedRevision;
    if (args.decision === "approved") {
      if (current) {
        const changed = await tx.characterConceptReference.updateMany({
          where: { id: current.id, revision: args.expectedRevision },
          data: {
            revision,
            assetId: args.assetId,
            snapshotJson: JSON.stringify(snapshot),
          },
        });
        if (changed.count !== 1)
          fail("REVISION_CONFLICT", "Reference changed.");
      } else
        await tx.characterConceptReference.create({
          data: {
            workspaceId: requireWorkspaceId(),
            characterId: args.characterId,
            assetId: args.assetId,
            revision,
            snapshotJson: JSON.stringify(snapshot),
          },
        });
    }
    const review = await tx.characterConceptReview.create({
      data: {
        workspaceId: requireWorkspaceId(),
        characterId: args.characterId,
        assetId: args.assetId,
        decision: args.decision,
        revision,
        notes: args.notes,
        snapshotJson: JSON.stringify(snapshot),
      },
    });
    return {
      reviewId: review.id,
      characterId: args.characterId,
      assetId: args.assetId,
      decision: args.decision,
      revision,
    };
  });
}
export async function getReference(characterId: string) {
  await characterSnapshot(characterId);
  const ref = await prisma.characterConceptReference.findFirst({
    where: { characterId },
  });
  if (!ref) return { characterId, revision: 0, reference: null };
  const snapshot = parse(ref.snapshotJson);
  const asset = ref.assetId
    ? await prisma.galleryAsset.findFirst({
        where: { id: ref.assetId, trashed: false },
      })
    : null;
  let stale = true;
  try {
    const now = await characterSnapshot(
      characterId,
      undefined,
      snapshot.draft?.outfitId,
    );
    stale = now.digest !== snapshot.characterDigest;
  } catch {}
  return {
    characterId,
    revision: ref.revision,
    reference: {
      assetId: ref.assetId,
      snapshot,
      stale,
      sourceAvailable: !!asset,
    },
  };
}
