import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { registerWorkspaceFile } from "@/lib/workspaces/files";
import { createGalleryMembership } from "@/lib/gallery/saveOutput";
import { type MediaRef, digest, fail, findReceipt, parse, receipt } from "./core";
import { assertCredential } from "./auth";
import { type Authority } from "./core";
import { galleryRow, galleryState, moveGalleryImage } from "./gallery";
import { readMedia } from "./media";
import { characterSnapshot } from "./catalog";
import { loadPlan, validatePlan } from "./plans";
import { characterReferencesFor } from "./prompt";
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
async function savedImageFor(source: MediaRef, bucket: string, db: any) {
  if (source.kind === "gallery_asset") return galleryRow(source.assetId, db);
  const where = { workspaceId: requireWorkspaceId(), sourceJobId: source.jobId, sourceOutputId: source.outputId, type: "image", trashed: false };
  return await db.galleryAsset.findFirst({ where: { ...where, bucket }, orderBy: { addedToGalleryAt: "asc" } }) ||
    await db.galleryAsset.findFirst({ where: { ...where, bucket: bucket === "common" ? "draft" : "common" }, orderBy: { addedToGalleryAt: "asc" } });
}
export async function saveOutput(auth: Authority, args: { source: MediaRef; bucket: string; requestKey: string }) {
  const prior = await findReceipt("save", args.requestKey, args);
  if (prior) return prior;
  // Existing Gallery originals only change membership; retain ID, file, tags and provenance.
  // Resolve again inside the transaction so concurrent preservation/saves cannot create copies.
  const existing = await savedImageFor(args.source, args.bucket, prisma);
  const data = existing ? null : await prepareSavedImage(args.source, args.bucket);
  return receipt("save", args.requestKey, args, async tx => {
    await assertCredential(auth.credentialId, auth.workspace.id, "curate", tx);
    const row = await savedImageFor(args.source, args.bucket, tx);
    if (row) return moveGalleryImage(row, args.bucket, tx);
    if (!data) fail("NOT_FOUND", "Gallery image is unavailable. Read its current state before retrying.");
    const result = await createGalleryMembership(data, tx);
    return { ...galleryState(result.asset), alreadySaved: result.alreadySaved, action: result.alreadySaved ? "unchanged" : "created", previousBucket: result.alreadySaved ? result.asset.bucket : null };
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
    // A manually promoted result is already preserved. Never recreate its old Draft.
    const promoted = await tx.galleryAsset.findFirst({ where: {
      workspaceId: requireWorkspaceId(), sourceJobId: variant.jobId, sourceOutputId: "output-1", bucket: "common",
    }, orderBy: { addedToGalleryAt: "asc" } });
    const result = promoted ? { asset: promoted } : await createGalleryMembership(data, tx, { respectTrash: true });
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
    if (snapshot.schemaVersion === 1 && snapshot.draft.characterId !== args.characterId)
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
      (p.snapshot.schemaVersion === 1 && p.snapshot.draft.characterId !== args.characterId) ||
      !p.snapshot.draft.references.some(
        (ref: MediaRef) =>
          ref.kind === "gallery_asset" && ref.assetId === asset.id,
      )
    )
      fail(
        "SNAPSHOT_ASSOCIATION_REQUIRED",
        "Plan must explicitly reference this asset and, for a legacy plan, its selected character.",
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
    // Association is an explicit review decision, not a hidden generation input.
    // Capture it in the review only; the immutable plan and Gallery provenance stay untouched.
    const reviewSnapshot = snapshot.schemaVersion === 2 ? {
      ...snapshot, reviewCharacter: await characterSnapshot(args.characterId, undefined, undefined, tx),
    } : snapshot;
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
            snapshotJson: JSON.stringify(reviewSnapshot),
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
            snapshotJson: JSON.stringify(reviewSnapshot),
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
        snapshotJson: JSON.stringify(reviewSnapshot),
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
    stale = now.digest !== (snapshot.reviewCharacter?.digest || snapshot.characterDigest);
    const tagged = snapshot.characterReferences?.filter((r: any) => r.characterId === characterId) || [];
    if (!stale && tagged.length) {
      const current = await characterReferencesFor(tagged.map((r: any) => r.token).join("\n"));
      stale = digest(current) !== digest(tagged);
    }
  } catch { stale = true; }
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
