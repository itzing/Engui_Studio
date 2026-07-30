import { beforeEach, describe, expect, it, vi } from 'vitest';
import RunPodService from '@/lib/runpodService';

describe('RunPodService WAN22 T2V payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends additional high/low LoRA pairs for wan22-t2v jobs', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'runpod-job-1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new RunPodService('runpod-key', 'endpoint-id');
    const jobId = await service.submitJob({
      _secure: { v: 1 },
      transport_request: { output_dir: '/tmp', output_file_name: 'result.mp4' },
      width: 832,
      height: 480,
      seed: 123,
      cfg: 1,
      length: 81,
      steps: 4,
      lora_high_1: '/runpod-volume/loras/custom-high.safetensors',
      lora_low_1: '/runpod-volume/loras/custom-low.safetensors',
      lora_high_1_weight: 0.45,
      lora_low_1_weight: 0.55,
    }, 'wan22-t2v');

    expect(jobId).toBe('runpod-job-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.input).toMatchObject({
      mode: 't2v',
      _secure: { v: 1 },
      width: 832,
      height: 480,
      seed: 123,
      cfg: 1,
      length: 81,
      steps: 4,
      lora_pairs: [
        {
          high: 'custom-high.safetensors',
          low: 'custom-low.safetensors',
          high_weight: 0.45,
          low_weight: 0.55,
        },
      ],
    });
  });

  it('sends high-only LoRA entries for wan22-t2v jobs', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'runpod-job-high-only' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new RunPodService('runpod-key', 'endpoint-id');
    await service.submitJob({
      _secure: { v: 1 },
      transport_request: { output_dir: '/tmp', output_file_name: 'result.mp4' },
      width: 832,
      height: 480,
      seed: 123,
      cfg: 1,
      length: 81,
      steps: 4,
      lora_high_1: '/runpod-volume/loras/custom-high-only.safetensors',
      lora_high_1_weight: 0.7,
    }, 'wan22-t2v');

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.input.lora_pairs).toEqual([
      {
        high: 'custom-high-only.safetensors',
        high_weight: 0.7,
        low_weight: 1,
      },
    ]);
  });

  it('passes WAN22 I2V continuation frame requests through to the endpoint input', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'runpod-job-2' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new RunPodService('runpod-key', 'endpoint-id');
    const jobId = await service.submitJob({
      _secure: { v: 1 },
      media_inputs: [{ role: 'source_image', kind: 'image' }],
      transport_request: { output_dir: '/tmp', output_file_name: 'result.bin' },
      width: 832,
      height: 480,
      seed: 123,
      cfg: 1,
      length: 80,
      steps: 4,
      fps: 32,
      sigma_shift: 7,
      return_continuation_frame: true,
    }, 'wan22');

    expect(jobId).toBe('runpod-job-2');
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.input).toMatchObject({
      _secure: { v: 1 },
      media_inputs: [{ role: 'source_image', kind: 'image' }],
      transport_request: { output_dir: '/tmp', output_file_name: 'result.bin' },
      fps: 32,
      sigma_shift: 7,
      return_continuation_frame: true,
    });
  });
});
