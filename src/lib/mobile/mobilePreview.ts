export type MobilePreviewKind = 'job' | 'gallery';

export type MobilePreviewItem = {
  id: string;
  kind: MobilePreviewKind;
  type: 'image' | 'video' | 'audio';
  url?: string;
  thumbnailUrl?: string | null;
  prompt?: string;
  modelId?: string;
  workspaceId?: string | null;
  sourceJobId?: string | null;
  status?: string;
  createdAt?: number;
  title?: string;
};

export const MOBILE_PREVIEW_STORAGE_KEY = 'engui.mobile.pending-preview';

export function normalizeMobilePreviewItem(value: unknown): MobilePreviewItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id : '';
  const type = item.type === 'image' || item.type === 'video' || item.type === 'audio' ? item.type : null;
  if (!id || !type) return null;

  const modelId = typeof item.modelId === 'string' ? item.modelId : undefined;
  return {
    id,
    kind: item.kind === 'gallery' ? 'gallery' : 'job',
    type,
    url: typeof item.url === 'string' ? item.url : undefined,
    thumbnailUrl: typeof item.thumbnailUrl === 'string' ? item.thumbnailUrl : null,
    prompt: typeof item.prompt === 'string' ? item.prompt : undefined,
    modelId,
    workspaceId: typeof item.workspaceId === 'string' ? item.workspaceId : null,
    sourceJobId: typeof item.sourceJobId === 'string' ? item.sourceJobId : null,
    status: typeof item.status === 'string' ? item.status : undefined,
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : undefined,
    title: typeof item.title === 'string' ? item.title : undefined,
  };
}

export function readStoredMobilePreview(): MobilePreviewItem | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeMobilePreviewItem(JSON.parse(window.localStorage.getItem(MOBILE_PREVIEW_STORAGE_KEY) || 'null'));
  } catch {
    return null;
  }
}

export function writeStoredMobilePreview(preview: MobilePreviewItem | null) {
  if (typeof window === 'undefined') return;
  if (!preview) {
    window.localStorage.removeItem(MOBILE_PREVIEW_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(MOBILE_PREVIEW_STORAGE_KEY, JSON.stringify(preview));
}

export function dispatchMobilePreview(preview: MobilePreviewItem | null) {
  if (typeof window === 'undefined') return;
  writeStoredMobilePreview(preview);
  window.dispatchEvent(new CustomEvent('jobHoverPreview', { detail: preview }));
}

export function buildJobPreviewItem(job: {
  id: string;
  type: 'image' | 'video' | 'audio' | 'tts' | 'music';
  resultUrl?: string | null;
  thumbnailUrl?: string | null;
  prompt?: string;
  modelId?: string;
  workspaceId?: string | null;
  status?: string;
  createdAt?: number;
}): MobilePreviewItem {
  return {
    id: job.id,
    kind: 'job',
    type: job.type === 'video' ? 'video' : (job.type === 'audio' || job.type === 'tts' || job.type === 'music') ? 'audio' : 'image',
    url: job.resultUrl || job.thumbnailUrl || undefined,
    thumbnailUrl: job.thumbnailUrl || null,
    prompt: job.prompt || '',
    modelId: job.modelId,
    workspaceId: job.workspaceId || null,
    status: job.status,
    createdAt: job.createdAt,
    title: job.modelId || 'Job preview',
  };
}

export function buildGalleryPreviewItem(asset: {
  id: string;
  type: 'image' | 'video' | 'audio';
  originalUrl: string;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  prompt?: string | null;
  workspaceId?: string | null;
  sourceJobId?: string | null;
  addedToGalleryAt?: string | number | Date;
}): MobilePreviewItem {
  const createdAt = typeof asset.addedToGalleryAt === 'string'
    ? new Date(asset.addedToGalleryAt).getTime()
    : asset.addedToGalleryAt instanceof Date
      ? asset.addedToGalleryAt.getTime()
      : typeof asset.addedToGalleryAt === 'number'
        ? asset.addedToGalleryAt
        : undefined;

  return {
    id: asset.id,
    kind: 'gallery',
    type: asset.type,
    url: asset.previewUrl || asset.originalUrl,
    thumbnailUrl: asset.thumbnailUrl || null,
    prompt: asset.prompt || '',
    modelId: 'gallery',
    workspaceId: asset.workspaceId || null,
    sourceJobId: asset.sourceJobId || null,
    createdAt,
    title: 'Gallery asset',
  };
}
