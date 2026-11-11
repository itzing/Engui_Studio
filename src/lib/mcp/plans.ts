import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { resolveImageVibe } from "@/lib/vibes/resolveImageVibe";
import { expandPromptWildcards } from "@/lib/prompt-wildcards/server";
import { resolvePromptVariants } from "@/lib/generation/promptVariants";
import {
  type GenerationDraft,
  type Authority,
  digest,
  fail,
  findReceipt,
  parse,
  receipt,
} from "./core";
import {
  characterSnapshot,
  composePrompt,
  effectiveSettings,
  modelConfiguration,
  selectedLoras,
} from "./catalog";
import { readMedia } from "./media";
import { assertCredential } from "./auth";
export async function currentDependencies(d: GenerationDraft) {
  const character = await characterSnapshot(
    d.characterId,
    d.characterVersionId,
    d.outfitId,
  );
  const loras = await selectedLoras(d.loras, d.modelId);
  const config = await modelConfiguration(d.modelId);
  if (!config.configured)
    fail("MODEL_NOT_CONFIGURED", "The selected model is not configured.");
  const vibe = d.vibeId
    ? await resolveImageVibe("", d.vibeId, requireWorkspaceId())
    : null;
  const references = [];
  for (const ref of d.references) {
    const image = await readMedia(ref);
    references.push({
      source: ref,
      sha256: image.hash,
      width: image.width,
      height: image.height,
      mimeType: image.mime,
    });
  }
  if (
    d.parentBatchId &&
    !(await prisma.mcpGenerationBatch.findFirst({
      where: { id: d.parentBatchId },
    }))
  )
    fail("NOT_FOUND", "Parent batch not found.");
  const wildcards = await prisma.promptWildcard.findMany({
    where: { workspaceId: requireWorkspaceId(), status: "active" },
    select: { key: true, value: true },
    orderBy: { key: "asc" },
  });
  return {
    character: character.snapshot,
    characterDigest: character.digest,
    loras,
    references,
    modelFingerprint: config.fingerprint,
    vibe: vibe?.sourceVibe || null,
    wildcardsDigest: digest(wildcards),
  };
}
export async function prepareGeneration(auth: Authority, d: GenerationDraft) {
  const existing = await findReceipt("prepare", d.requestKey, d);
  if (existing) return existing;
  const settings = effectiveSettings(d);
  const dep = await currentDependencies(d);
  const composition = composePrompt(dep.character, d);
  const vibe = await resolveImageVibe(
    composition.prompt,
    d.vibeId || "",
    requireWorkspaceId(),
  );
  const expanded = await expandPromptWildcards(
    vibe.prompt,
    requireWorkspaceId(),
  );
  const seeds = d.seeds ? [...d.seeds] : [];
  while (seeds.length < d.variantCount) {
    const seed = randomInt(0, 2147483647);
    if (!seeds.includes(seed)) seeds.push(seed);
  }
  const variants = seeds.map((seed, index) => ({
    index,
    label: ["A", "B", "C"][index],
    seed,
    prompt: resolvePromptVariants(expanded.prompt, seed),
    negativePrompt: d.negativePrompt || "",
    settings: { ...settings, seed },
  }));
  if (variants.some((v) => v.prompt.length > 64000))
    fail("INVALID_ARGUMENT", "Composed prompt is too large.");
  const snapshot = {
    schemaVersion: 1,
    draft: d,
    ...dep,
    stages: {
      basePrompt: d.prompt,
      identityPrompt: composition.prompt,
      vibePrompt: vibe.prompt,
      expandedPrompt: expanded.prompt,
      wildcardReplacements: expanded.replacements,
      wildcardSelections: expanded.selections,
    },
    variants,
    warnings: composition.composition.warnings,
    estimatedCost: null,
    costStatus: "unknown",
  };
  const planDigest = digest(snapshot);
  return receipt("prepare", d.requestKey, d, async (tx) => {
    await assertCredential(
      auth.credentialId,
      auth.workspace.id,
      "generate",
      tx,
    );
    const p = await tx.mcpGenerationPlan.create({
      data: {
        workspaceId: requireWorkspaceId(),
        credentialId: auth.credentialId,
        inputDigest: digest(d),
        digest: planDigest,
        snapshotJson: JSON.stringify(snapshot),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    return {
      planId: p.id,
      planDigest,
      expiresAt: p.expiresAt.toISOString(),
      snapshot,
      batchId: null,
    };
  });
}
export async function loadPlan(planId: string, db: any = prisma) {
  const p = await db.mcpGenerationPlan.findFirst({
    where: { id: planId, workspaceId: requireWorkspaceId() },
  });
  if (!p) fail("NOT_FOUND", "Plan not found.");
  return { ...p, snapshot: parse(p.snapshotJson) };
}
export async function getPlan(planId: string) {
  const p = await loadPlan(planId);
  const batch = await prisma.mcpGenerationBatch.findFirst({
    where: { planId },
  });
  return {
    planId: p.id,
    planDigest: p.digest,
    expiresAt: p.expiresAt.toISOString(),
    snapshot: p.snapshot,
    batchId: batch?.id || null,
  };
}
export async function validatePlan(p: any, checkExpiry = true) {
  if (checkExpiry && p.expiresAt.getTime() <= Date.now())
    fail("PLAN_EXPIRED", "Prepare a new plan before generating.");
  if (digest(p.snapshot) !== p.digest)
    fail("PLAN_STALE", "Plan integrity check failed.");
  const current = await currentDependencies(p.snapshot.draft);
  for (const k of [
    "characterDigest",
    "loras",
    "references",
    "modelFingerprint",
    "vibe",
    "wildcardsDigest",
  ])
    if (digest(current[k as keyof typeof current]) !== digest(p.snapshot[k]))
      fail(
        "PLAN_STALE",
        "A prepared source or configuration has changed. Prepare a new plan.",
      );
}
