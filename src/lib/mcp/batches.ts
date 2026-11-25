import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import {
  type Authority,
  fail,
  findReceipt,
  limits,
  parse,
  receipt,
} from "./core";
import { settleCancelledUnknownBatch } from "@/lib/uncertainJobs";
import { assertCredential } from "./auth";
import { loadPlan, validatePlan } from "./plans";
import { terminalVariants, batchState, variantStatus, batchCounts, statusMessage } from "./batch-status";
export { batchState, terminalVariants } from "./batch-status";
export async function startGeneration(
  auth: Authority,
  args: { planId: string; planDigest: string; requestKey: string },
) {
  const old = await findReceipt("start", args.requestKey, args);
  if (old) return old;
  const p = await loadPlan(args.planId);
  if (p.digest !== args.planDigest)
    fail("PLAN_STALE", "Plan digest does not match.");
  const existing = await prisma.mcpGenerationBatch.findFirst({
    where: { planId: p.id },
  });
  if (!existing) await validatePlan(p);
  return receipt("start", args.requestKey, args, async (tx) => {
    await assertCredential(
      auth.credentialId,
      auth.workspace.id,
      "generate",
      tx,
    );
    let batch = await tx.mcpGenerationBatch.findFirst({
      where: { planId: p.id },
      include: { variants: { orderBy: { index: "asc" } } },
    });
    if (!batch) {
      if (
        (await tx.mcpGenerationBatch.count({
          where: { variants: { some: { state: { notIn: terminalVariants } } } },
        })) >= limits().activeBatches
      )
        fail("RATE_LIMITED", `Workspace limit of ${limits().activeBatches} active batches reached. This is an Engui concurrency limit, not a provider limit. Use engui_get_batch; cancel unwanted batches with engui_cancel_batch. Uncertain cancelled work can be stopped locally without retrying inference.`);
      if (p.expiresAt.getTime() <= Date.now())
        fail("PLAN_EXPIRED", "Prepare a new plan.");
      const created = await tx.mcpGenerationBatch.create({
        data: {
          workspaceId: requireWorkspaceId(),
          planId: p.id,
          credentialId: auth.credentialId,
        },
      });
      const variants = [];
      for (const v of p.snapshot.variants)
        variants.push(
          await tx.mcpGenerationVariant.create({
            data: {
              workspaceId: requireWorkspaceId(),
              batchId: created.id,
              index: v.index,
              jobId: randomUUID(),
              state: "queued",
            },
          }),
        );
      batch = { ...created, variants };
    }
    return {
      batchId: batch.id,
      planId: p.id,
      variants: batch.variants.map((v: any) => ({
        variantId: v.id,
        label: ["A", "B", "C"][v.index],
        jobId: v.jobId,
      })),
      accepted: true,
    };
  });
}
export async function cancelBatch(args: {
  batchId: string;
  requestKey: string;
}) {
  const result = await receipt("cancel", args.requestKey, args, async (tx) => {
    const batch = await tx.mcpGenerationBatch.findFirst({
      where: { id: args.batchId },
    });
    if (!batch) fail("NOT_FOUND", "Batch not found.");
    await tx.mcpGenerationBatch.update({
      where: { id: batch.id },
      data: { cancelledAt: batch.cancelledAt || new Date() },
    });
    await tx.mcpGenerationVariant.updateMany({
      where: { batchId: batch.id, state: "queued" },
      data: { state: "cancelled" },
    });
    return { batchId: batch.id, cancellationRequested: true };
  });
  // Also reconcile old cancellation receipts; replay never re-submits inference.
  await settleCancelledUnknownBatch(args.batchId);
  const stopped = await prisma.mcpGenerationVariant.findMany({where:{batchId:args.batchId,state:"abandoned"},select:{jobId:true}});
  return {...result, locallyStoppedJobIds:stopped.map(v=>v.jobId), providerOutcomeUnknown:stopped.length>0};
}
export async function getBatch(batchId: string) {
  const b = await prisma.mcpGenerationBatch.findFirst({
    where: { id: batchId },
    include: { plan: true, variants: { orderBy: { index: "asc" } } },
  });
  if (!b) fail("NOT_FOUND", "Batch not found.");
  const snapshot = parse(b.plan.snapshotJson);
  const jobs = await prisma.job.findMany({
    where: { id: { in: b.variants.map((v) => v.jobId) } },
    select: { id: true, status: true, runpodJobId: true, error: true },
  });
  const jobsById = new Map(jobs.map((j) => [j.id, j]));
  const blocked = b.variants.some((v) => v.state === "submission_unknown");
  const variants = [];
  for (const v of b.variants) {
    const asset = v.assetId
      ? await prisma.galleryAsset.findFirst({
          where: { id: v.assetId },
          select: { id: true, bucket: true, trashed: true },
        })
      : null;
    const activeAsset = asset && !asset.trashed ? asset : null;
    const status = variantStatus(v, jobsById.get(v.jobId), !!b.cancelledAt, blocked);
    variants.push({
      variantId: v.id,
      label: ["A", "B", "C"][v.index],
      jobId: v.jobId,
      ...status,
      seed: snapshot.variants[v.index].seed,
      modelId: snapshot.draft.modelId,
      errorCode: ["succeeded", "cancelled"].includes(status.state) ? null : v.errorCode || (status.phase === "failed" ? "PROVIDER_REJECTED" : status.phase === "submission_unknown" ? "SUBMISSION_UNKNOWN" : null),
      outputId: status.phase === "succeeded" ? "output-1" : null,
      assetId: activeAsset?.id || null,
      gallery: asset ? { assetId: asset.id, bucket: asset.bucket, status: asset.trashed ? "trash" : "active" } : null,
      preservationState:
        asset?.trashed ? "trashed" : v.assetId && !asset ? "unavailable" : v.preservationState,
      source: activeAsset
        ? { kind: "gallery_asset", assetId: activeAsset.id }
        : status.phase === "succeeded"
          ? { kind: "job_output", jobId: v.jobId, outputId: "output-1" }
          : null,
    });
  }
  const state = batchState(variants, !!b.cancelledAt);
  const isTerminal = variants.length > 0 && variants.every((v) => v.isTerminal);
  return {
    batchId: b.id,
    planId: b.planId,
    state,
    statusMessage: statusMessage(state),
    isTerminal,
    cancellationRequested: !!b.cancelledAt,
    observedAt: new Date().toISOString(),
    counts: batchCounts(variants),
    variants,
    provenance: snapshot,
    pollAfterSeconds: isTerminal ? 0 : 5,
  };
}
