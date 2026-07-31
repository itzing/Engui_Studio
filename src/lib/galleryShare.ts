export type GalleryShareAssetType = 'image' | 'video';

export type GalleryShareResult = 'file' | 'url' | 'copied' | 'cancelled';

type ShareInput = {
  id: string;
  type: GalleryShareAssetType;
  originalUrl: string;
  title?: string | null;
};

const FALLBACK_MIME_TYPES: Record<GalleryShareAssetType, string> = {
  image: 'image/png',
  video: 'video/mp4',
};

const FALLBACK_EXTENSIONS: Record<GalleryShareAssetType, string> = {
  image: 'png',
  video: 'mp4',
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function getExtension(type: GalleryShareAssetType, mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'video/quicktime') return 'mov';
  return FALLBACK_EXTENSIONS[type];
}

async function buildShareFile(input: ShareInput) {
  const response = await fetch(input.originalUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch gallery asset: ${response.status}`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || FALLBACK_MIME_TYPES[input.type];
  const extension = getExtension(input.type, mimeType);
  return new File([blob], `gallery-${input.id}.${extension}`, { type: mimeType });
}

async function shareUrl(input: ShareInput): Promise<GalleryShareResult> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: input.title || `Gallery ${input.type}`,
        url: input.originalUrl,
      });
      return 'url';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(input.originalUrl);
    return 'copied';
  }

  throw new Error('Sharing is not available in this browser');
}

export async function shareGalleryAsset(input: ShareInput): Promise<GalleryShareResult> {
  if (typeof navigator === 'undefined') {
    throw new Error('Sharing is only available in the browser');
  }

  if (navigator.share) {
    try {
      const file = await buildShareFile(input);
      const payload = {
        title: input.title || `Gallery ${input.type}`,
        files: [file],
      };
      if (!navigator.canShare || navigator.canShare(payload)) {
        await navigator.share(payload);
        return 'file';
      }
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
    }
  }

  return shareUrl(input);
}
