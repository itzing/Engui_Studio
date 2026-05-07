import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  buildCharacterPreviewPrompt,
  DEFAULT_CHARACTER_PREVIEW_MODEL_ID,
  getCharacterPreviewSlotMeta,
  normalizeCharacterPreviewSlot,
} from '@/lib/characters/previews';
import type { CharacterPreviewSlot, CharacterPreviewState, CharacterSummary } from '@/lib/characters/types';
import {
  normalizeCharacterPreviewState,
  serializeCharacterPreviewState,
  toCharacterSummary,
} from '@/lib/characters/utils';

function parseJsonObject<T extends Record<string, unknown>>(value: string | null | undefined): T {
  if (!value) return {} as T;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch (error) {
    console.warn('Failed to parse persisted character preview JSON payload:', error);
  }

  return {} as T;
}

function normalizeUrlCandidate(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildJobOutputUrls(job: { options?: unknown; resultUrl?: string | null }) {
  const options = typeof job.options === 'string'
    ? parseJsonObject<Record<string, unknown>>(job.options)
    : (job.options && typeof job.options === 'object' ? job.options as Record<string, unknown> : {});

  const directCandidates = [
    normalizeUrlCandidate(job.resultUrl),
    normalizeUrlCandidate(options.url),
    normalizeUrlCandidate(options.resultUrl),
    normalizeUrlCandidate(options.image),
    normalizeUrlCandidate(options.image_url),
    normalizeUrlCandidate(options.image_path),
    normalizeUrlCandidate(options.output_path),
    normalizeUrlCandidate(options.s3_path),
  ].filter(Boolean) as string[];

  const listCandidates: string[] = [];
  for (const key of ['images', 'outputs', 'resultUrls'] as const) {
    const value = options[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      const normalized = normalizeUrlCandidate(item);
      if (normalized) listCandidates.push(normalized);
    }
  }

  return Array.from(new Set([...directCandidates, ...listCandidates]));
}

function resolveLocalPathFromUrl(url: string): string | null {
  if (!url.startsWith('/')) return null;
  const normalized = url.split('?')[0];
  if (normalized.startsWith('/generations/')) return path.join(process.cwd(), 'public', normalized.replace(/^\//, ''));
  if (normalized.startsWith('/results/')) return path.join(process.cwd(), 'public', normalized.replace(/^\//, ''));
  return null;
}

function getExtensionFromUrl(url: string) {
  const pathname = url.split('?')[0];
  return path.extname(pathname) || '.png';
}

function materializeLocalOutput(url: string, characterId: string, slot: CharacterPreviewSlot, variant?: 'thumbnail') {
  const localPath = resolveLocalPathFromUrl(url);
  if (!localPath || !fs.existsSync(localPath)) {
    return url;
  }

  const bytes = fs.readFileSync(localPath);
  const contentHash = crypto.createHash('sha256').update(bytes).digest('hex');
  const ext = getExtensionFromUrl(url);
  const dir = path.join(process.cwd(), 'public', 'generations', 'characters', characterId, slot);
  fs.mkdirSync(dir, { recursive: true });

  const suffix = variant === 'thumbnail' ? '--thumb' : '';
  const fileName = `${contentHash}${suffix}${ext}`;
  const dest = path.join(dir, fileName);
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, bytes);
  }

  return `/generations/characters/${characterId}/${slot}/${fileName}`;
}

type CharacterDbLike = {
  character: {
    findUnique: (args: Record<string, unknown>) => Promise<any>;
    update: (args: Record<string, unknown>) => Promise<any>;
  };
};

async function loadCharacterPreviewState(characterId: string, db: CharacterDbLike = prisma as any) {
  const character = await db.character.findUnique({
    where: { id: characterId },
    include: {
      _count: {
        select: {
          versions: true,
        },
      },
    },
  });

  if (!character || character.deletedAt) {
    return null;
  }

  return {
    character,
    previewState: normalizeCharacterPreviewState(parseJsonObject<CharacterPreviewState>(character.previewStateJson)),
  };
}

async function persistCharacterPreviewState(characterId: string, previewState: CharacterPreviewState, db: CharacterDbLike = prisma as any) {
  const updated = await db.character.update({
    where: { id: characterId },
    data: {
      previewStateJson: serializeCharacterPreviewState(previewState),
    },
    include: {
      _count: {
        select: {
          versions: true,
        },
      },
    },
  });

  return toCharacterSummary(updated);
}

export async function queueCharacterPreviewGeneration(
  params: {
    characterId: string;
    slot: CharacterPreviewSlot;
    jobId: string;
    promptSnapshot: string;
  },
  db: CharacterDbLike = prisma as any,
) {
  const loaded = await loadCharacterPreviewState(params.characterId, db);
  if (!loaded) {
    throw new Error('Character not found');
  }

  const { previewState } = loaded;
  const existingSlot = previewState[params.slot];
  previewState[params.slot] = {
    ...existingSlot,
    slot: params.slot,
    status: 'queued',
    jobId: params.jobId,
    error: null,
    promptSnapshot: params.promptSnapshot,
    updatedAt: new Date().toISOString(),
  };

  return persistCharacterPreviewState(params.characterId, previewState, db);
}

function applyFailedPreviewState(previewState: CharacterPreviewState, slot: CharacterPreviewSlot, jobId: string, sourceError: string, promptSnapshot: string | null) {
  const currentSlot = previewState[slot];
  if (currentSlot.jobId && currentSlot.jobId !== jobId) {
    return false;
  }

  previewState[slot] = {
    ...currentSlot,
    slot,
    status: 'failed',
    jobId,
    error: sourceError,
    promptSnapshot: currentSlot.promptSnapshot || promptSnapshot,
    updatedAt: new Date().toISOString(),
  };

  return true;
}

export const characterPreviewMaterializationHandler = {
  async materialize({ job, task, payload }: { job: any; task: any; payload: Record<string, unknown> }) {
    const slot = normalizeCharacterPreviewSlot(payload.slot);
    if (!slot) {
      throw new Error('Character preview materialization requires a valid slot');
    }

    const loaded = await loadCharacterPreviewState(task.targetId);
    if (!loaded) {
      return;
    }

    const { previewState } = loaded;
    const currentSlot = previewState[slot];
    if (currentSlot.jobId && currentSlot.jobId !== job.id) {
      return;
    }

    const outputUrl = buildJobOutputUrls(job)[0] ?? normalizeUrlCandidate(job.resultUrl);
    if (!outputUrl) {
      throw new Error(`Completed character preview job ${job.id} has no output URL`);
    }

    const imageUrl = materializeLocalOutput(outputUrl, task.targetId, slot);
    const thumbnailUrl = normalizeUrlCandidate(job.thumbnailUrl)
      ? materializeLocalOutput(job.thumbnailUrl, task.targetId, slot, 'thumbnail')
      : imageUrl;

    previewState[slot] = {
      ...currentSlot,
      slot,
      status: 'ready',
      jobId: job.id,
      imageUrl,
      previewUrl: thumbnailUrl || imageUrl,
      thumbnailUrl: thumbnailUrl || imageUrl,
      error: null,
      promptSnapshot: currentSlot.promptSnapshot || (typeof job.prompt === 'string' ? job.prompt : null),
      updatedAt: new Date().toISOString(),
    };

    await persistCharacterPreviewState(task.targetId, previewState);
  },

  async onSourceJobFailed({ job, task, payload, sourceError }: { job: any; task: any; payload: Record<string, unknown>; sourceError: string }) {
    const slot = normalizeCharacterPreviewSlot(payload.slot);
    if (!slot) {
      return;
    }

    const loaded = await loadCharacterPreviewState(task.targetId);
    if (!loaded) {
      return;
    }

    const { previewState } = loaded;
    const changed = applyFailedPreviewState(
      previewState,
      slot,
      job.id,
      sourceError,
      typeof job.prompt === 'string' ? job.prompt : null,
    );

    if (!changed) {
      return;
    }

    await persistCharacterPreviewState(task.targetId, previewState);
  },
};

export function buildCharacterPreviewSubmission(character: CharacterSummary, slot: CharacterPreviewSlot) {
  const prompt = buildCharacterPreviewPrompt(character, slot);
  const meta = getCharacterPreviewSlotMeta(slot);

  return {
    modelId: DEFAULT_CHARACTER_PREVIEW_MODEL_ID,
    prompt,
    width: meta.width,
    height: meta.height,
    slot,
  };
}
