import { prisma } from '@/lib/prisma';
import type { PromptWildcardReplacement } from './types';
import {
  displayNameToPromptWildcardKey,
  normalizePromptWildcardKey,
  toPromptWildcardSummary,
  validatePromptWildcardKey,
} from './utils';
import { getPromptWildcardVariants, normalizePromptWildcardVariant } from './variants';
import {
  normalizePromptWildcardSelections,
  parsePromptWildcardIndexList,
  type PromptWildcardSelectionMap,
} from './selections';

const defaultPromptWildcards = [
  {
    key: 'eyesColor',
    name: 'Eye color',
    value: '{blue eyes|green eyes|brown eyes|hazel eyes|gray eyes|amber eyes|dark eyes|light eyes}',
  },
  {
    key: 'bodyBuildType',
    name: 'Body type',
    value: '{slim build|athletic build|curvy build|toned build|soft build|petite build|tall build}',
  },
  {
    key: 'hairColor',
    name: 'Hair color',
    value: '{black hair|dark brown hair|brown hair|chestnut hair|auburn hair|red hair|copper hair|blonde hair|platinum blonde hair|silver hair|pastel pink hair}',
  },
  {
    key: 'haircut',
    name: 'Haircut',
    value: '{straight hair|sleek straight hair|wavy hair|loose waves|beach waves|soft waves|curly hair|tight curls|loose curls|coily hair|afro|bob cut|lob cut|pixie cut|shag cut|layered hair|blunt cut|curtain bangs|side-swept bangs|straight bangs|wispy bangs|middle part|side part|slicked-back hair|high ponytail|low ponytail|half-up hairstyle|half-up bun|messy bun|top knot|low bun|chignon|braided bun|french braid|dutch braid|fishtail braid|box braids|cornrows|crown braid|waterfall braid|pigtails|space buns|updo|formal updo|voluminous blowout|retro waves|finger waves|wet look|crimped hair|teased hair|hair with clips|hair with headband|hair scarf style}',
  },
];

export async function ensureDefaultPromptWildcards(workspaceId: string) {
  const existingCount = await prisma.promptWildcard.count({ where: { workspaceId } });
  if (existingCount > 0) return;

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) return;

  await prisma.promptWildcard.createMany({
    data: defaultPromptWildcards.map((wildcard) => ({
      workspaceId,
      ...wildcard,
      status: 'active',
    })),
  });
}

export async function listPromptWildcards(workspaceId: string) {
  await ensureDefaultPromptWildcards(workspaceId);
  const wildcards = await prisma.promptWildcard.findMany({
    where: { workspaceId, status: 'active' },
    orderBy: [{ name: 'asc' }],
  });
  return wildcards.map(toPromptWildcardSummary);
}

export async function createPromptWildcard(workspaceId: string, input: { name?: unknown; key?: unknown; value?: unknown }) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) throw new Error('Workspace not found');

  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'New wildcard';
  const key = normalizePromptWildcardKey(input.key) || displayNameToPromptWildcardKey(name) || 'newWildcard';
  const value = typeof input.value === 'string' ? input.value : '';
  validatePromptWildcardKey(key);

  const wildcard = await prisma.promptWildcard.create({
    data: { workspaceId, name, key, value, status: 'active' },
  });
  return toPromptWildcardSummary(wildcard);
}

export async function updatePromptWildcard(id: string, input: { name?: unknown; key?: unknown; value?: unknown }) {
  const existing = await prisma.promptWildcard.findUnique({ where: { id } });
  if (!existing || existing.status === 'trash') return null;

  const key = input.key === undefined ? existing.key : normalizePromptWildcardKey(input.key);
  validatePromptWildcardKey(key);

  const wildcard = await prisma.promptWildcard.update({
    where: { id },
    data: {
      name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : existing.name,
      key,
      value: typeof input.value === 'string' ? input.value : existing.value,
    },
  });
  return toPromptWildcardSummary(wildcard);
}

export async function trashPromptWildcard(id: string) {
  const existing = await prisma.promptWildcard.findUnique({ where: { id } });
  if (!existing) return null;
  const wildcard = await prisma.promptWildcard.update({ where: { id }, data: { status: 'trash' } });
  return toPromptWildcardSummary(wildcard);
}

type ExpandPromptWildcardsOptions = {
  selections?: unknown;
};

function pickIndexedVariants(variants: string[], indices: number[]) {
  return indices
    .filter((index) => Number.isInteger(index) && index >= 0 && index < variants.length)
    .map((index) => ({ index, value: variants[index] }))
    .filter((entry): entry is { index: number; value: string } => typeof entry.value === 'string' && entry.value.trim().length > 0);
}

function getOccurrenceSelectionKey(key: string, occurrenceIndex: number) {
  return `${key}__occ_${occurrenceIndex}`;
}

function countIndexedWildcardOccurrences(input: string) {
  const counts = new Map<string, number>();
  const matcher = /\{([A-Za-z][A-Za-z0-9_]*):([^{}\n]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(input)) !== null) {
    if (!parsePromptWildcardIndexList(match[2])) continue;
    counts.set(match[1], (counts.get(match[1]) || 0) + 1);
  }

  return counts;
}

export async function expandPromptWildcards(
  input: string,
  workspaceId: string | null | undefined,
  options: ExpandPromptWildcardsOptions = {},
) {
  if (!input || !workspaceId || !input.includes('{')) {
    return {
      prompt: input,
      replacements: [] as PromptWildcardReplacement[],
      selections: normalizePromptWildcardSelections(options.selections),
    };
  }

  const wildcards = await prisma.promptWildcard.findMany({
    where: { workspaceId, status: 'active' },
    select: { key: true, name: true, value: true },
  });
  const selections = normalizePromptWildcardSelections(options.selections);
  const nextSelections: PromptWildcardSelectionMap = { ...selections };
  if (wildcards.length === 0) return { prompt: input, replacements: [] as PromptWildcardReplacement[], selections: nextSelections };

  const byKey = new Map(wildcards.map((wildcard) => [wildcard.key, wildcard]));
  const replacements = new Map<string, PromptWildcardReplacement>();
  const indexedOccurrenceTotals = countIndexedWildcardOccurrences(input);
  const indexedOccurrenceCursors = new Map<string, number>();
  let prompt = input;

  prompt = prompt.replace(/\{([A-Za-z][A-Za-z0-9_]*):([^{}\n]+)\}/g, (match, key: string, rawVariant: string) => {
    const wildcard = byKey.get(key);
    if (!wildcard) return match;

    const variants = getPromptWildcardVariants(wildcard.value);
    const requestedIndices = parsePromptWildcardIndexList(rawVariant);
    if (requestedIndices) {
      const occurrenceIndex = indexedOccurrenceCursors.get(key) || 0;
      indexedOccurrenceCursors.set(key, occurrenceIndex + 1);

      const selectedVariants = pickIndexedVariants(variants, requestedIndices);
      if (selectedVariants.length === 0) return match;

      const selectionKey = (indexedOccurrenceTotals.get(key) || 0) > 1
        ? getOccurrenceSelectionKey(key, occurrenceIndex)
        : key;
      const selection = nextSelections[selectionKey] || nextSelections[key];
      if (selection?.mode === 'sequential') {
        const cursor = Math.max(0, Math.min(selection.cursor, selectedVariants.length - 1));
        const selected = selectedVariants[cursor] || selectedVariants[0];
        nextSelections[selectionKey] = {
          indices: selectedVariants.map((variant) => variant.index),
          mode: 'sequential',
          startIndex: Math.max(0, Math.min(selection.startIndex, selectedVariants.length - 1)),
          cursor: (cursor + 1) % selectedVariants.length,
        };
        replacements.set(`${selectionKey}:${match}`, {
          key,
          name: wildcard.name,
          placeholder: match,
          variant: selected.value,
          variantIndex: selected.index,
          variantIndices: selectedVariants.map((variant) => variant.index),
          mode: 'sequential',
          selectedPosition: cursor,
        });
        return selected.value;
      }

      replacements.set(`${key}:${match}`, {
        key,
        name: wildcard.name,
        placeholder: match,
        variantIndices: selectedVariants.map((variant) => variant.index),
        mode: 'random',
      });

      if (selectedVariants.length === 1) return selectedVariants[0].value;
      return `{${selectedVariants.map((variant) => variant.value).join('|')}}`;
    }

    const requestedVariant = normalizePromptWildcardVariant(rawVariant);
    const selectedVariant = variants
      .find((variant) => normalizePromptWildcardVariant(variant) === requestedVariant);
    if (!selectedVariant) return match;

    replacements.set(`${key}:${selectedVariant}`, {
      key,
      name: wildcard.name,
      placeholder: match,
      variant: selectedVariant,
    });
    return selectedVariant;
  });

  for (let pass = 0; pass < 5; pass += 1) {
    let changed = false;
    prompt = prompt.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key: string) => {
      const wildcard = byKey.get(key);
      if (!wildcard) return match;
      changed = true;
      replacements.set(key, { key, name: wildcard.name, placeholder: match });
      return wildcard.value;
    });
    if (!changed) break;
  }

  return { prompt, replacements: Array.from(replacements.values()), selections: nextSelections };
}
