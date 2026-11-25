import { galleryState } from "./gallery";
import { readOperatorPolicy, modelAvailability, preferredVibeId, preferredVibeMarker } from "./operator-policy";
import { prisma } from "@/lib/prisma";
import { readVersionIdentity } from "@/lib/characters/versionIdentity";
import { readPartDocument } from "@/lib/looks/parts";
import { characterState } from "./authoring-state";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import SettingsService from "@/lib/settingsService";
import { getModelById, validateParameter } from "@/lib/models/modelConfig";
import { filterLorasForModel } from "@/lib/lora/modelFilters";
import { resolveCharacterLook, outfitSummary } from "@/lib/outfits/server";
import { composeCharacterLook } from "@/lib/outfits/compose";
import { toCharacterSummary } from "@/lib/characters/utils";
import { FRAMING_TEXT } from "@/lib/looks/parts";
import {
  type GenerationDraft,
  digest,
  fail,
  nextCursor,
  pageCursor,
  parse,
} from "./core";
export const supportedModels = [
  "krea2-turbo",
  "z-image",
  "qwen-image-edit",
  "qwen-image-edit-maskflow",
] as const;
export function modes(model: string) {
  if (model === "qwen-image-edit-maskflow") return ["masked_image_edit"];
  return ["krea2-turbo", "z-image"].includes(model)
    ? ["text_to_image", "image_to_image"]
    : ["image_edit"];
}
export function parameterNames(model: string, mode?: string) {
  return model.startsWith("qwen-image-edit")
    ? ["steps", "guidance"]
    : [
        "steps",
        "cfg",
        ...(["krea2-turbo", "z-image"].includes(model) && (!mode || mode === "image_to_image")
          ? ["denoise"]
          : []),
      ];
}
export async function modelConfiguration(modelId: string) {
  const { settings } = await new SettingsService().getSettings(
    "user-with-settings",
  );
  const endpoint = (
    settings.runpod?.endpoints as Record<string, string> | undefined
  )?.[modelId];
  const configured = !!(
    endpoint &&
    settings.runpod?.apiKey &&
    settings.runpod?.fieldEncKeyB64 &&
    settings.s3?.endpointUrl &&
    settings.s3?.accessKeyId &&
    settings.s3?.secretAccessKey
  );
  return {
    configured,
    fingerprint: digest({
      modelId,
      endpoint: endpoint || null,
      storage: settings.s3?.endpointUrl,
      bucket: settings.s3?.bucketName,
    }),
  };
}
export async function listModels() {
  const policy = await readOperatorPolicy();
  return Promise.all(
    supportedModels.map(async (modelId) => {
      const m = getModelById(modelId)!;
      const config = await modelConfiguration(modelId);
      return {
        id: modelId,
        name: m.name,
        modes: modes(modelId),
        configured: config.configured,
        ...modelAvailability(modelId, config.configured, policy),
        health: null,
        parameters: m.parameters
          .filter((p) =>
            ["width", "height", "seed", ...parameterNames(modelId)].includes(
              p.name,
            ),
          )
          .map((p) => ({
            name: p.name,
            type: p.type,
            default:
              p.name === "width" || p.name === "height"
                ? 1024
                : p.name === "seed"
                  ? null
                  : p.default,
            min: p.name === "seed" ? 0 : (p.min ?? null),
            max: p.name === "seed" ? 2147483647 : (p.max ?? null),
            multipleOf: p.validation?.multipleOf ?? null,
          })),
        maxReferences:
          modelId === "qwen-image-edit" ? 2 : ["krea2-turbo", "z-image", "qwen-image-edit-maskflow"].includes(modelId) ? 1 : 0,
        maxLoras: modelId.startsWith("qwen-image-edit") ? 0 : 8,
        ...(modelId === "qwen-image-edit-maskflow" ? { mask: { required: true, kinds: ["image", "rectangles"], white: "edit", black: "preserve", coordinateSystem: "normalized_source", maxPixels: 1048576, recommendedSteps: 50, automaticSegmentation: false } } : {}),
      };
    }),
  );
}
export function effectiveSettings(d: GenerationDraft) {
  if (d.modelId === "qwen-image-edit-maskflow") {
    if (!d.mask || d.references.length !== 1) fail("INVALID_ARGUMENT", "MaskFlow requires one source reference and a separate mask.");
    if (d.width * d.height > 1048576) fail("INVALID_ARGUMENT", "MaskFlow supports at most 1 megapixel per output.");
  } else if (d.mask) fail("INVALID_ARGUMENT", "Masks are supported only by qwen-image-edit-maskflow.");
  if (!modes(d.modelId).includes(d.mode))
    fail("UNSUPPORTED_MODE", "Model does not support this mode.");
  if (
    (d.mode === "text_to_image" && d.references.length) ||
    (d.mode === "image_to_image" && d.references.length !== 1) ||
    (d.mode === "image_edit" &&
      (d.references.length < 1 || d.references.length > 2))
  )
    fail(
      "INVALID_ARGUMENT",
      "Reference count does not match the selected mode.",
    );
  if (
    d.modelId.startsWith("qwen-image-edit") &&
    (d.loras.length || d.negativePrompt !== undefined)
  )
    fail(
      "INVALID_ARGUMENT",
      "Qwen does not accept LoRAs or negativePrompt in this adapter.",
    );
  const m = getModelById(d.modelId)!;
  const names = parameterNames(d.modelId, d.mode);
  if (Object.keys(d.parameters).some((n) => !names.includes(n)))
    fail("INVALID_ARGUMENT", "Unsupported parameter for model or mode.");
  const values: Record<string, number> = { width: d.width, height: d.height };
  for (const name of names)
    values[name] =
      d.parameters[name as keyof typeof d.parameters] ??
      Number(m.parameters.find((p) => p.name === name)!.default);
  for (const [name, value] of Object.entries(values)) {
    const p = m.parameters.find((p) => p.name === name)!;
    const check = validateParameter(p, value);
    if (!Number.isFinite(value) || !check.valid)
      fail("INVALID_ARGUMENT", `${name} is outside the supported bounds.`);
  }
  if (
    d.seeds &&
    (d.seeds.length !== d.variantCount ||
      new Set(d.seeds).size !== d.seeds.length)
  )
    fail("INVALID_ARGUMENT", "Supply one distinct seed per variant.");
  if (new Set(d.loras.map((l) => l.id)).size !== d.loras.length)
    fail("INVALID_ARGUMENT", "Duplicate LoRA selection.");
  return values;
}
export async function characterSnapshot(
  characterId: string,
  versionId?: string,
  outfitId?: string,
  db: any = prisma,
  identityOnly = false,
) {
  const row = await db.character.findFirst({
    where: {
      id: characterId,
      workspaceId: requireWorkspaceId(),
      deletedAt: null,
    },
  });
  if (!row) fail("NOT_FOUND", "Character not found.");
  let selected = row;
  if (versionId) {
    const v = await db.characterVersion.findFirst({
      where: { id: versionId, characterId },
    });
    if (!v) fail("NOT_FOUND", "Character version not found.");
    const identity = readVersionIdentity(v.identitySnapshot);
    if (!identity && v.id !== row.currentVersionId)
      fail("VERSION_INCOMPLETE", "This historical version has no name/gender snapshot. Use an existing generation plan for exact provenance.");
    selected = {
      ...row,
      ...(identity || {}),
      traits: v.traitsSnapshot,
      editorState: v.editorStateSnapshot,
      currentVersionId: v.id,
    };
  }
  const selection = identityOnly
    ? { mode: "custom" as const, customText: "" }
    : outfitId
    ? { mode: "outfit" as const, outfitId }
    : { mode: "default" as const };
  let look = identityOnly
    ? composeCharacterLook(toCharacterSummary(selected), selection, null)
    : await resolveCharacterLook(characterId, selection, db);
  if (versionId) {
    const outfit = look.outfitId
      ? await db.outfit.findFirst({
          where: { id: look.outfitId, deletedAt: null },
        })
      : null;
    look = composeCharacterLook(
      toCharacterSummary(selected),
      selection,
      outfit ? outfitSummary(outfit) : null,
    );
  }
  const { resolvedAt, ...stableLook } = look;
  const snapshot = {
    characterId: row.id,
    characterName: selected.name,
    characterVersionId: selected.currentVersionId,
    traits: parse(selected.traits),
    gender: selected.gender,
    look: stableLook,
  };
  return { snapshot, digest: digest(snapshot) };
}
export function composePrompt(d: GenerationDraft) {
  const composition = {
    identity: "", outfit: "", warnings: [] as string[],
    framingPrompt: d.framing === "custom" ? "" : FRAMING_TEXT[d.framing],
  };
  const view = d.view && d.view !== "custom" ? {
    front: "Front view.", three_quarter: "Three-quarter view.", side: "Side view.",
  }[d.view] : "";
  return {
    prompt: [composition.framingPrompt, view, d.prompt].filter(Boolean).join("\n\n"),
    composition,
  };
}
export async function selectedLoras(
  items: GenerationDraft["loras"],
  modelId: string,
) {
  const found = [];
  for (const entry of items) {
    const row = await prisma.loRA.findFirst({
      where: { id: entry.id, lifecycle: "active" },
    });
    if (
      !row ||
      !row.sourceKey ||
      !row.storageTarget ||
      !filterLorasForModel([row], modelId).length
    )
      fail("NOT_FOUND", "Compatible LoRA not found.");
    found.push({
      id: row.id,
      name: row.name,
      weight: entry.weight,
      shared: row.workspaceId !== requireWorkspaceId(),
      fingerprint: digest({
        id: row.id,
        sourceKey: row.sourceKey,
        storageTarget: row.storageTarget,
        baseModel: row.baseModel,
        isShared: row.isShared,
        updatedAt: row.updatedAt.toISOString(),
      }),
    });
  }
  return found;
}
export async function characterDetail(characterId: string, versionId?: string) {
  return prisma.$transaction(async (tx) => {
    const c = await characterSnapshot(characterId, versionId, undefined, tx);
    const state = await characterState(characterId, tx);
    const outfits = await tx.outfit.findMany({
      where: { deletedAt: null, OR: [{ ownerCharacterId: null }, { ownerCharacterId: characterId }] },
      select: { id: true, name: true, revision: true }, orderBy: { id: "asc" }, take: 50,
    });
    const reference = await tx.characterConceptReference.findFirst({ where: { characterId } });
    const selectedVersion = versionId ? await tx.characterVersion.findFirst({ where: { id: versionId, characterId } }) : null;
    return { ...c.snapshot, digest: c.digest, outfits,
      editRevision: versionId ? null : state.editRevision,
      defaultOutfitId: state.row.defaultOutfitId,
      identityParts: readPartDocument(parse(selectedVersion?.editorStateSnapshot || state.row.editorState).promptParts)?.parts || null,
      reference: reference ? { assetId: reference.assetId, revision: reference.revision } : null,
    };
  });
}
export async function listRecords(kind: string, args: any) {
  const filter = {
    kind,
    query: args.query || "",
    characterId: args.characterId || null,
    modelId: args.modelId || null,
    favoritesOnly: args.favoritesOnly || false,
    ...(kind === "gallery" ? { bucket: args.bucket || null, status: args.status || "active" } : {}),
  };
  const cursor = pageCursor(args.cursor, filter);
  const after = cursor ? { id: { gt: cursor } } : {};
  const q = args.query ? { contains: args.query } : undefined;
  let rows: any[] = [];
  if (kind === "characters")
    rows = (
      await prisma.character.findMany({
        where: { ...after, deletedAt: null, ...(q ? { name: q } : {}) },
        orderBy: { id: "asc" },
        take: args.limit + 1,
      })
    ).map((c) => ({
      id: c.id,
      name: c.name,
      versionId: c.currentVersionId,
      updatedAt: c.updatedAt.toISOString(),
    }));
  if (kind === "gallery")
    rows = (
      await prisma.galleryAsset.findMany({
        where: {
          ...after,
          type: "image",
          trashed: args.status === "trash",
          ...(args.bucket ? { bucket: args.bucket } : {}),
          ...(args.favoritesOnly ? { favorited: true } : {}),
          ...(q
            ? {
                OR: [
                  { userTags: q },
                  { autoTags: q },
                  { generationSnapshot: q },
                ],
              }
            : {}),
        },
        orderBy: { id: "asc" },
        take: args.limit + 1,
      })
    ).map((a) => ({ id: a.id, ...galleryState(a) }));
  if (kind === "outfits") {
    if (args.characterId) await characterSnapshot(args.characterId);
    rows = await prisma.outfit.findMany({
      where: {
        ...after,
        deletedAt: null,
        OR: [
          { ownerCharacterId: null },
          ...(args.characterId ? [{ ownerCharacterId: args.characterId }] : []),
        ],
        ...(q ? { name: q } : {}),
      },
      orderBy: { id: "asc" },
      take: args.limit + 1,
      select: { id: true, name: true, description: true, revision: true },
    });
  }
  if (kind === "wildcards")
    rows = await prisma.promptWildcard.findMany({
      where: { ...after, workspaceId: requireWorkspaceId(), status: "active",
        ...(q ? { OR: [{ key: q }, { name: q }] } : {}) },
      orderBy: { id: "asc" }, take: args.limit + 1,
      select: { id: true, key: true, name: true, value: true },
    });
  if (kind === "vibes") {
    const preferredId = await preferredVibeId();
    rows = (await prisma.vibePreset.findMany({
      where: { ...after, status: "active", ...(q ? { name: q } : {}) },
      orderBy: { id: "asc" },
      take: args.limit + 1,
      select: { id: true, name: true, baseDescription: true },
    })).map(row => ({ ...row, ...preferredVibeMarker(row.id, "active", preferredId) }));
  }
  if (kind === "loras") {
    if (!args.modelId)
      fail("INVALID_ARGUMENT", "Select modelId to list compatible LoRAs.");
    if (args.modelId !== "qwen-image-edit") {
      const candidates = await prisma.loRA.findMany({
        where: {
          ...after,
          lifecycle: "active",
          baseModel: args.modelId,
          ...(q ? { name: q } : {}),
        },
        orderBy: { id: "asc" },
        take: args.limit + 1,
      });
      rows = filterLorasForModel(candidates, args.modelId).map((l: any) => ({
        id: l.id,
        name: l.name,
        baseModel: l.baseModel,
        shared: l.workspaceId !== requireWorkspaceId(),
      }));
    }
  }
  const more = rows.length > args.limit;
  const items = rows.slice(0, args.limit);
  return {
    items,
    nextCursor: more ? nextCursor(items[items.length - 1].id, filter) : null,
  };
}
