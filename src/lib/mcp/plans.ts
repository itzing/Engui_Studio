import { assertModelAllowed } from "./operator-policy";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { generationVibe } from "./vibes";
import { expandMcpPrompt, characterReferencesFor, renderMcpVariant } from "./prompt";
import {
  type GenerationDraft,
  type InternalGenerationDraft,
  type Authority,
  McpError,
  digest,
  fail,
  findReceipt,
  parse,
  receipt,
} from "./core";
import {
  characterSnapshot,
  effectiveSettings,
  modelConfiguration,
  selectedLoras,
} from "./catalog";
import { readMedia } from "./media";
import { readMask } from "./masks";
import { readRegionalMask } from "./regional";
import { assertCredential } from "./auth";
export async function currentDependencies(d: InternalGenerationDraft) {
  await assertModelAllowed(d.modelId);
  const loras = await selectedLoras(d.loras, d.modelId);
  const config = await modelConfiguration(d.modelId);
  if (!config.configured)
    fail("MODEL_NOT_CONFIGURED", "The selected model is not configured.");
  const vibe = await generationVibe(d.vibeId);
  const references = [];
  for (const ref of d.references) {
    const image = await readMedia(ref);
    if (d.mask && image.orientation !== 1) fail("INVALID_MASK", "Normalize source image orientation before masked editing.");
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
    loras,
    references,
    ...(d.mask ? { mask: (await readMask(d.mask, references[0].width, references[0].height)).snapshot } : {}),
    ...(d.regions ? { regions: await Promise.all(d.regions.map(async region => ({
      loras: await selectedLoras(region.loras, d.modelId),
      mask: (await readRegionalMask(region.mask, d.width, d.height)).snapshot,
    }))) } : {}),
    modelFingerprint: config.fingerprint,
    vibe,
    wildcardsDigest: digest(wildcards),
  };
}
export async function prepareGeneration(auth: Authority, d: GenerationDraft) {
  await assertModelAllowed(d.modelId);
  const existing = await findReceipt("prepare", d.requestKey, d);
  if (existing) return existing;
  const settings = effectiveSettings(d);
  const dep = await currentDependencies(d);
  const rendering = await expandMcpPrompt(d, dep.vibe);
  const regionRendering = await Promise.all((d.regions || []).map(region =>
    expandMcpPrompt({ ...d, prompt:region.prompt, framing:"custom",view:undefined,vibeId:undefined }, null)));
  const { composition, vibe, expanded } = rendering;
  const characterReferences = [...new Map(
    [rendering, ...regionRendering].flatMap(r=>r.characterReferences).map(ref=>[ref.token,ref]),
  ).values()];
  const seeds = d.seeds ? [...d.seeds] : [];
  while (seeds.length < d.variantCount) {
    const seed = randomInt(0, 2147483647);
    if (!seeds.includes(seed)) seeds.push(seed);
  }
  const variants = seeds.map((seed, index) => ({
    index,
    label: ["A", "B", "C"][index],
    seed,
    ...renderMcpVariant(rendering.protectedText, rendering.characterReferences, seed),
    ...(d.regions ? { regions: regionRendering.map(r => renderMcpVariant(r.protectedText, r.characterReferences, seed)) } : {}),
    negativePrompt: d.negativePrompt || "",
    settings: { ...settings, seed },
  }));
  if (variants.some((v) => v.prompt.length + (v.regions || []).reduce((n,r)=>n+r.prompt.length,0) > 64000))
    fail("INVALID_ARGUMENT", "Composed prompt is too large.");
  const snapshot = {
    schemaVersion: 2,
    draft: d,
    ...dep,
    characterReferences,
    stages: {
      basePrompt: d.prompt,
      identityPrompt: composition.prompt,
      vibePrompt: vibe.prompt,
      expandedPrompt: expanded.prompt,
      characterMode: rendering.explicitCharacters ? "inline" : "plain",
      characterReferences,
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
  if (!Array.isArray(p.snapshot.characterReferences) &&
      p.snapshot.variants.some((v: any) => v.prompt.includes("{character:")))
    fail("PLAN_STALE", "This legacy plan contains unresolved character tags. Prepare a new plan; old plans are never rewritten.");
  if (Array.isArray(p.snapshot.characterReferences) && p.snapshot.characterReferences.length) {
    let references;
    try {
      references = await characterReferencesFor(p.snapshot.characterReferences.map((ref: any) => ref.token).join("\n"));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "INVALID_CHARACTER_REFERENCE")
        fail("PLAN_STALE", "A referenced character or default outfit is no longer available. Prepare a new plan.");
      throw error;
    }
    if (digest(references) !== digest(p.snapshot.characterReferences))
      fail("PLAN_STALE", "A referenced character or default outfit changed. Prepare a new plan.");
  }
  // Legacy plans retain their original selection/freshness rules without rewriting snapshots.
  // New plans never load a primary Character; their tag snapshots above are the only identities.
  if (p.snapshot.schemaVersion === 1 && p.snapshot.draft.characterId) {
    const d = p.snapshot.draft;
    const character = await characterSnapshot(d.characterId, d.characterVersionId, d.outfitId, prisma,
      p.snapshot.stages?.characterMode === "inline" && Array.isArray(p.snapshot.characterReferences));
    if (character.digest !== p.snapshot.characterDigest)
      fail("PLAN_STALE", "A legacy Character source changed. Prepare a new plan using Character tags.");
  }
  let current;
  try { current = await currentDependencies(p.snapshot.draft); }
  catch (error) {
    if (error instanceof McpError && error.code === "VIBE_UNAVAILABLE")
      fail("PLAN_STALE", "The prepared Vibe is unavailable. Prepare a new plan without it or select another active Vibe.");
    throw error;
  }
  for (const k of [
    "loras",
    "references",
    "modelFingerprint",
    "vibe",
    ...(p.snapshot.datasetStudio ? [] : ["wildcardsDigest"]),
    ...(p.snapshot.draft.mask ? ["mask"] : []),
    ...(p.snapshot.draft.regions ? ["regions"] : []),
  ])
    if (digest(current[k as keyof typeof current]) !== digest(p.snapshot[k]))
      fail(
        "PLAN_STALE",
        "A prepared source or configuration has changed. Prepare a new plan.",
      );
}
