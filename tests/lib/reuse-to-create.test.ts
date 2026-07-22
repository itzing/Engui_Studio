import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistCreateReuseDraft = vi.hoisted(() => vi.fn(() => ({ workflow: 'video', modelId: 'wan22' })));
const announceCreateModeChange = vi.hoisted(() => vi.fn());

vi.mock('@/lib/create/persistCreateReuseDraft', () => ({ persistCreateReuseDraft }));
vi.mock('@/lib/create/createModeEvents', () => ({ announceCreateModeChange }));

import { prepareCreateReuseDraft } from '@/lib/create/reuseToCreate';

describe('prepareCreateReuseDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prepares a gallery asset img2vid draft and announces the workflow', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, payload: { type: 'image', action: 'img2vid' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await prepareCreateReuseDraft({ kind: 'gallery-asset', id: 'asset-1' }, 'img2vid');

    expect(fetchMock).toHaveBeenCalledWith('/api/gallery/assets/asset-1/reuse', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'img2vid' }),
    }));
    expect(persistCreateReuseDraft).toHaveBeenCalledWith({ type: 'image', action: 'img2vid' });
    expect(announceCreateModeChange).toHaveBeenCalledWith('video');
  });

  it('uses output-1 by default for job img2vid reuse', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, payload: { type: 'image', action: 'img2vid' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await prepareCreateReuseDraft({ kind: 'job', id: 'job-1' }, 'img2vid');

    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/job-1/reuse', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'img2vid', outputId: 'output-1' }),
    }));
  });
});
