import { describe, expect, it } from 'vitest';
import { filterLorasForModel, filterLorasForTarget, getLoraSearchText, getVideoLoraPathSet } from '@/lib/lora/modelFilters';

const lora = (fileName: string, s3Path: string, name = fileName) => ({
  id: s3Path,
  name,
  fileName,
  s3Path,
});

describe('LoRA model filters', () => {
  it('treats complete low/high pairs in the same folder as video LoRAs', () => {
    const loras = [
      lora('high_noise_model.safetensors', '/runpod-volume/loras/Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1/high_noise_model.safetensors'),
      lora('low_noise_model.safetensors', '/runpod-volume/loras/Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1/low_noise_model.safetensors'),
      lora('portrait_style.safetensors', '/runpod-volume/loras/portrait_style.safetensors'),
    ];

    expect(Array.from(getVideoLoraPathSet(loras)).sort()).toEqual([
      '/runpod-volume/loras/Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1/high_noise_model.safetensors',
      '/runpod-volume/loras/Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1/low_noise_model.safetensors',
    ]);
    expect(filterLorasForTarget(loras, 'video').map((entry) => entry.fileName)).toEqual([
      'high_noise_model.safetensors',
      'low_noise_model.safetensors',
    ]);
    expect(filterLorasForTarget(loras, 'image').map((entry) => entry.fileName)).toEqual([
      'portrait_style.safetensors',
    ]);
  });

  it('keeps incomplete high or low files in the image bucket', () => {
    const loras = [
      lora('style_high.safetensors', '/runpod-volume/loras/style_high.safetensors'),
      lora('portrait_style.safetensors', '/runpod-volume/loras/portrait_style.safetensors'),
    ];

    expect(filterLorasForTarget(loras, 'video')).toEqual([]);
    expect(filterLorasForTarget(loras, 'image').map((entry) => entry.fileName)).toEqual([
      'style_high.safetensors',
      'portrait_style.safetensors',
    ]);
  });

  it('maps wan22 to video LoRAs and image models to image LoRAs', () => {
    const loras = [
      lora('dramatic_high.safetensors', '/runpod-volume/loras/dramatic_high.safetensors'),
      lora('dramatic_low.safetensors', '/runpod-volume/loras/dramatic_low.safetensors'),
      lora('z_style.safetensors', '/runpod-volume/loras/z_style.safetensors'),
    ];

    expect(filterLorasForModel(loras, 'wan22').map((entry) => entry.fileName)).toEqual([
      'dramatic_high.safetensors',
      'dramatic_low.safetensors',
    ]);
    expect(filterLorasForModel(loras, 'z-image').map((entry) => entry.fileName)).toEqual([
      'z_style.safetensors',
    ]);
  });

  it('builds search text from filename, display name, and path', () => {
    const entry = lora('high_noise_model.safetensors', '/runpod-volume/loras/DR34/i2v/high_noise_model.safetensors', 'DR34 High');

    expect(getLoraSearchText(entry)).toContain('dr34');
    expect(getLoraSearchText(entry)).toContain('i2v');
    expect(getLoraSearchText(entry)).toContain('high_noise_model');
  });
});
