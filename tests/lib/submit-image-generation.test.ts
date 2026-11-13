import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock('@/lib/workspaces/client', () => ({ workspaceFetch: mockFetch }));
import { submitImageGeneration } from '@/lib/create/submitImageGeneration';
import { getModelById } from '@/lib/models/modelConfig';

describe('image submission Randomize preference', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true, jobId: 'fixture', seed: 777 }), { status: 200 }));
  });

  it.each([[true, true], [false, true], [true, false], [false, false]])(
    'keeps Randomize=%s separate from preselected=%s on the wire and in the client job', async (randomizeSeed, seedIsPreselected) => {
      const result = await submitImageGeneration({
        currentModel: getModelById('z-image')!, prompt: 'Regression fixture', parameterValues: {seed: 777},
        randomizeSeed, seedIsPreselected, activeWorkspaceId: 'fixture-ws',
        settings: {apiKeys: {}, runpod: {endpoints: {}}} as any, imageFile: null, imageFile2: null,
      });
      expect(result.success).toBe(true);
      const [url, request] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/generate');
      expect(request.body.get('randomizeSeed')).toBe(String(randomizeSeed));
      expect(request.body.get('seedIsPreselected')).toBe(seedIsPreselected ? 'true' : null);
      expect(request.body.get('seed')).toBe('777');
      if (result.success) {
        expect(result.job.options).toMatchObject({randomizeSeed, seed: 777});
        expect(result.job.options).not.toHaveProperty('seedIsPreselected');
      }
    },
  );
});
