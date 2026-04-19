import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { generateJobImageThumbnail, maybeGenerateJobImageThumbnail } from '@/lib/jobPreviewDerivatives';

const createdPaths = new Set<string>();

async function removeIfExists(targetPath: string) {
  try {
    await fs.unlink(targetPath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

afterEach(async () => {
  for (const targetPath of createdPaths) {
    await removeIfExists(targetPath);
  }
  createdPaths.clear();
});

describe('jobPreviewDerivatives', () => {
  it('generates a deterministic local thumbnail for completed image jobs', async () => {
    const publicDir = path.join(process.cwd(), 'public', 'generations');
    await fs.mkdir(publicDir, { recursive: true });

    const sourcePath = path.join(publicDir, 'job-preview-test-source.png');
    const sourceUrl = '/generations/job-preview-test-source.png';
    const sourcePng = await sharp({
      create: {
        width: 16,
        height: 12,
        channels: 3,
        background: { r: 120, g: 80, b: 200 },
      },
    }).png().toBuffer();

    await fs.writeFile(sourcePath, sourcePng);
    createdPaths.add(sourcePath);

    const thumbnailUrl = await generateJobImageThumbnail({
      job: {
        id: 'job-preview-test',
        modelId: 'wan22',
        type: 'image',
      },
      resultUrl: sourceUrl,
    });

    expect(thumbnailUrl).toMatch(/^\/generations\/job-previews\/wan22-job-preview-test-thumb-[a-f0-9]{8}\.webp$/);

    const thumbnailPath = path.join(process.cwd(), 'public', thumbnailUrl!.replace(/^\/+/, ''));
    createdPaths.add(thumbnailPath);

    const stats = await fs.stat(thumbnailPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it('returns null for non-image jobs and preserves existing thumbnails', async () => {
    await expect(maybeGenerateJobImageThumbnail({
      id: 'audio-job',
      modelId: 'elevenlabs-tts',
      type: 'audio',
      resultUrl: '/results/audio.mp3',
    })).resolves.toBeNull();

    await expect(maybeGenerateJobImageThumbnail({
      id: 'image-job',
      modelId: 'wan22',
      type: 'image',
      resultUrl: '/generations/already-there.png',
      thumbnailUrl: '/generations/job-previews/existing.webp',
    })).resolves.toBe('/generations/job-previews/existing.webp');
  });
});
