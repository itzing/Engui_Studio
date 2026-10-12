import { describe, it, expect } from 'vitest';
import RunPodService from '@/lib/runpodService';
import { buildLoraPairs } from '@/lib/lora/modelFilters';
describe('workspace-aware LoRA payloads', () => {
  it('preserves namespaces and Default root in WAN payload pairs', () => {
    const service = new RunPodService('fixture', 'fixture');
    const pairs = (service as any).buildWan22LoraPairs({
      lora_high_1: '/runpod-volume/loras/workspaces/A/style_high.safetensors',
      lora_low_1: '/runpod-volume/loras/workspaces/A/style_low.safetensors',
      lora_high_2: '/runpod-volume/loras/default_high.safetensors',
      lora_low_2: '/runpod-volume/loras/default_low.safetensors',
    });
    expect(pairs[0].high).toBe('workspaces/A/style_high.safetensors');
    expect(pairs[0].low).toBe('workspaces/A/style_low.safetensors');
    expect(pairs[1].high).toBe('default_high.safetensors');
  });
  it('does not combine WAN pairs from separate owners', () => {
    const high = { id: 'high', workspaceId: 'A', name: 'style_high', fileName: 'style_high.safetensors', s3Path: '/runpod-volume/loras/workspaces/A/style_high.safetensors', baseModel: 'wan2.2', isShared: false };
    const low = { id: 'low', workspaceId: 'B', name: 'style_low', fileName: 'style_low.safetensors', s3Path: '/runpod-volume/loras/workspaces/B/style_low.safetensors', baseModel: 'wan2.2', isShared: false };
    expect(buildLoraPairs([high, low] as any).every(pair => !pair.isComplete)).toBe(true);
  });
});
