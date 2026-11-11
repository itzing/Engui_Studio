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
import { assertCredential } from "./auth";
import { loadPlan, validatePlan } from "./plans";
export const terminalVariants = ["succeeded", "failed", "cancelled"];
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
        fail("RATE_LIMITED", "Maximum active workspace batches reached.");
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
  return receipt("cancel", args.requestKey, args, async (tx) => {
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
}
export function batchState(variants: any[], cancelled: boolean) {
  const states = variants.map((v) => v.state);
  if (states.includes("submission_unknown")) return "needs_attention";
  if (states.every((s) => terminalVariants.includes(s))) {
    if (states.every((s) => s === "succeeded")) return "completed";
    if (states.every((s) => s === "cancelled")) return "cancelled";
    if (states.some((s) => s === "succeeded")) return "partial";
    return "failed";
  }
  if (cancelled) return "cancel_requested";
  if (states.every((s) => s === "queued")) return "queued";
  return "running";
}
export async function getBatch(batchId: string) {
  const b = await prisma.mcpGenerationBatch.findFirst({
    where: { id: batchId },
    include: { plan: true, variants: { orderBy: { index: "asc" } } },
  });
  if (!b) fail("NOT_FOUND", "Batch not found.");
  const snapshot = parse(b.plan.snapshotJson);
  const variants = [];
  for (const v of b.variants) {
    const asset = v.assetId
      ? await prisma.galleryAsset.findFirst({
          where: { id: v.assetId, trashed: false },
          select: { id: true },
        })
      : null;
    variants.push({
      variantId: v.id,
      label: ["A", "B", "C"][v.index],
      jobId: v.jobId,
      state: v.state,
      seed: snapshot.variants[v.index].seed,
      modelId: snapshot.draft.modelId,
      errorCode: v.errorCode,
      outputId: v.state === "succeeded" ? "output-1" : null,
      assetId: asset?.id || null,
      preservationState:
        v.assetId && !asset ? "unavailable" : v.preservationState,
      source: asset
        ? { kind: "gallery_asset", assetId: asset.id }
        : v.state === "succeeded"
          ? { kind: "job_output", jobId: v.jobId, outputId: "output-1" }
          : null,
    });
  }
  return {
    batchId: b.id,
    planId: b.planId,
    state: batchState(variants, !!b.cancelledAt),
    counts: {
      total: variants.length,
      succeeded: variants.filter((v) => v.state === "succeeded").length,
      failed: variants.filter((v) => v.state === "failed").length,
    },
    variants,
    provenance: snapshot,
    pollAfterSeconds: 5,
  };
}
