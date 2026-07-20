import { prisma } from '@/lib/prisma';
import type { PromptWildcardReplacement } from './types';
import {
  displayNameToPromptWildcardKey,
  normalizePromptWildcardKey,
  toPromptWildcardSummary,
  validatePromptWildcardKey,
} from './utils';

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

export async function expandPromptWildcards(input: string, workspaceId: string | null | undefined) {
  if (!input || !workspaceId || !input.includes('{')) {
    return { prompt: input, replacements: [] as PromptWildcardReplacement[] };
  }

  const wildcards = await prisma.promptWildcard.findMany({
    where: { workspaceId, status: 'active' },
    select: { key: true, name: true, value: true },
  });
  if (wildcards.length === 0) return { prompt: input, replacements: [] as PromptWildcardReplacement[] };

  const byKey = new Map(wildcards.map((wildcard) => [wildcard.key, wildcard]));
  const replacements = new Map<string, PromptWildcardReplacement>();
  let prompt = input;

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

  return { prompt, replacements: Array.from(replacements.values()) };
}
