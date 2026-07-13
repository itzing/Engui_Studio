'use client';

const STORAGE_KEY = 'engui:wan22-video:source-image-prompt-cache:v1';
const MAX_CACHE_ENTRIES = 50;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const VIDEO_SOURCE_PROMPT_EXTRACTION_VERSION = 'wan22-i2v-source-context-v1';

export type VideoSourcePromptCacheKey = {
  key: string;
  fingerprint: string;
  modelId: string;
  extractionVersion: string;
};

type VideoSourcePromptCacheEntry = VideoSourcePromptCacheKey & {
  prompt: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
};

type VideoSourcePromptCachePayload = {
  version: 1;
  entries: VideoSourcePromptCacheEntry[];
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function readPayload(): VideoSourcePromptCachePayload {
  const storage = getStorage();
  if (!storage) return { version: 1, entries: [] };

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, entries: [] };
    const parsed = JSON.parse(raw) as Partial<VideoSourcePromptCachePayload>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return { version: 1, entries: [] };
    }
    return {
      version: 1,
      entries: parsed.entries.filter((entry): entry is VideoSourcePromptCacheEntry => {
        return !!entry
          && typeof entry.key === 'string'
          && typeof entry.fingerprint === 'string'
          && typeof entry.modelId === 'string'
          && typeof entry.extractionVersion === 'string'
          && typeof entry.prompt === 'string'
          && typeof entry.createdAt === 'number'
          && typeof entry.updatedAt === 'number'
          && typeof entry.lastUsedAt === 'number';
      }),
    };
  } catch {
    return { version: 1, entries: [] };
  }
}

function writePayload(payload: VideoSourcePromptCachePayload) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist video source prompt cache', error);
  }
}

function pruneEntries(entries: VideoSourcePromptCacheEntry[], now = Date.now()) {
  return entries
    .filter((entry) => now - entry.updatedAt <= CACHE_TTL_MS)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_CACHE_ENTRIES);
}

function hashBytes(bytes: Uint8Array) {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function readFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  const arrayBuffer = (file as File & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer;
  if (typeof arrayBuffer === 'function') {
    return arrayBuffer.call(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read source image fingerprint bytes'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read source image fingerprint bytes'));
    reader.readAsArrayBuffer(file);
  });
}

export async function buildVideoSourcePromptCacheKey(file: File, modelId: string): Promise<VideoSourcePromptCacheKey> {
  const bytes = new Uint8Array(await readFileArrayBuffer(file));
  const fingerprint = [
    'fnv1a32',
    file.size,
    file.type || 'application/octet-stream',
    hashBytes(bytes),
  ].join(':');
  const safeModelId = modelId.trim() || 'unknown-model';

  return {
    key: [safeModelId, VIDEO_SOURCE_PROMPT_EXTRACTION_VERSION, fingerprint].join('|'),
    fingerprint,
    modelId: safeModelId,
    extractionVersion: VIDEO_SOURCE_PROMPT_EXTRACTION_VERSION,
  };
}

export function readVideoSourcePromptCache(cacheKey: string): string | null {
  const payload = readPayload();
  const now = Date.now();
  const entries = pruneEntries(payload.entries, now);
  const match = entries.find((entry) => entry.key === cacheKey);

  if (!match) {
    if (entries.length !== payload.entries.length) {
      writePayload({ version: 1, entries });
    }
    return null;
  }

  match.lastUsedAt = now;
  writePayload({ version: 1, entries });
  return match.prompt.trim() || null;
}

export function writeVideoSourcePromptCache(input: VideoSourcePromptCacheKey & {
  prompt: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}) {
  const prompt = input.prompt.trim();
  if (!prompt) return;

  const payload = readPayload();
  const now = Date.now();
  const entries = payload.entries.filter((entry) => entry.key !== input.key);
  entries.unshift({
    key: input.key,
    fingerprint: input.fingerprint,
    modelId: input.modelId,
    extractionVersion: input.extractionVersion,
    prompt,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileType: input.fileType,
  });

  writePayload({ version: 1, entries: pruneEntries(entries, now) });
}
