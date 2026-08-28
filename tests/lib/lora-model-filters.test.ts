import { describe, expect, it } from 'vitest';
import { buildLoraPairs, filterLorasForModel, filterLorasForTarget, getLoraSearchText, getVideoLoraPathSet } from '@/lib/lora/modelFilters';

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

  it('allows manual video overrides for incomplete high-only LoRAs', () => {
    const loras = [
      { ...lora('single_high.safetensors', '/runpod-volume/loras/single_high.safetensors'), targetOverride: 'video' },
      lora('portrait_style.safetensors', '/runpod-volume/loras/portrait_style.safetensors'),
    ];

    expect(filterLorasForTarget(loras, 'video').map((entry) => entry.fileName)).toEqual([
      'single_high.safetensors',
    ]);
    expect(filterLorasForTarget(loras, 'image').map((entry) => entry.fileName)).toEqual([
      'portrait_style.safetensors',
    ]);

    const pairs = buildLoraPairs(filterLorasForModel(loras, 'wan22'));
    expect(pairs).toHaveLength(1);
    expect(pairs[0].isComplete).toBe(false);
    expect(pairs[0].high?.fileName).toBe('single_high.safetensors');
  });

  it('allows manual image overrides to exclude complete pairs from video models', () => {
    const loras = [
      { ...lora('dramatic_high.safetensors', '/runpod-volume/loras/dramatic_high.safetensors'), targetOverride: 'image' },
      lora('dramatic_low.safetensors', '/runpod-volume/loras/dramatic_low.safetensors'),
    ];

    expect(filterLorasForModel(loras, 'wan22')).toEqual([]);
    expect(filterLorasForModel(loras, 'z-image').map((entry) => entry.fileName)).toEqual([
      'dramatic_high.safetensors',
      'dramatic_low.safetensors',
    ]);
  });

  it('maps WAN22 video models to video LoRAs and image models to image LoRAs', () => {
    const loras = [
      lora('dramatic_high.safetensors', '/runpod-volume/loras/dramatic_high.safetensors'),
      lora('dramatic_low.safetensors', '/runpod-volume/loras/dramatic_low.safetensors'),
      lora('z_style.safetensors', '/runpod-volume/loras/z_style.safetensors'),
    ];

    expect(filterLorasForModel(loras, 'wan22').map((entry) => entry.fileName)).toEqual([
      'dramatic_high.safetensors',
      'dramatic_low.safetensors',
    ]);
    expect(filterLorasForModel(loras, 'wan22-t2v').map((entry) => entry.fileName)).toEqual([
      'dramatic_high.safetensors',
      'dramatic_low.safetensors',
    ]);
    expect(filterLorasForModel(loras, 'z-image').map((entry) => entry.fileName)).toEqual([
      'z_style.safetensors',
    ]);
  });

  it('filters image LoRAs by explicit base model for Z-Image and Krea2 Turbo', () => {
    const loras = [
      { ...lora('z_style.safetensors', '/runpod-volume/loras/z_style.safetensors'), baseModel: 'z-image' },
      { ...lora('krea_style.safetensors', '/runpod-volume/loras/krea_style.safetensors'), baseModel: 'krea2-turbo' },
      lora('legacy_image.safetensors', '/runpod-volume/loras/legacy_image.safetensors'),
    ];

    expect(filterLorasForModel(loras, 'z-image').map((entry) => entry.fileName)).toEqual([
      'z_style.safetensors',
      'legacy_image.safetensors',
    ]);
    expect(filterLorasForModel(loras, 'krea2-turbo').map((entry) => entry.fileName)).toEqual([
      'krea_style.safetensors',
    ]);
  });

  it('builds complete picker pairs with the same low/high rules as target filtering', () => {
    const loras = [
      lora('high_noise_model.safetensors', '/runpod-volume/loras/Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1/high_noise_model.safetensors'),
      lora('low_noise_model.safetensors', '/runpod-volume/loras/Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1/low_noise_model.safetensors'),
      lora('YummyHD_HighNoise.safetensors', '/runpod-volume/loras/YummyHD_HighNoise.safetensors', 'YummyHD_HighNoise'),
      lora('YummyHD_LowNoise.safetensors', '/runpod-volume/loras/YummyHD_LowNoise.safetensors', 'YummyHD_LowNoise'),
      lora('dramatic_high.safetensors', '/runpod-volume/loras/dramatic_high.safetensors'),
      lora('dramatic_low.safetensors', '/runpod-volume/loras/dramatic_low.safetensors'),
      lora('lonely_high.safetensors', '/runpod-volume/loras/lonely_high.safetensors'),
      lora('portrait_style.safetensors', '/runpod-volume/loras/portrait_style.safetensors'),
    ];

    const pairs = buildLoraPairs(filterLorasForModel(loras, 'wan22'));

    expect(pairs).toHaveLength(3);
    expect(pairs.map((pair) => pair.baseName)).toEqual([
      'dramatic',
      'Wan2.2-I2V-A14B-4steps-lora-rank64-Seko-V1',
      'yummyhd',
    ]);
    expect(pairs.every((pair) => pair.isComplete)).toBe(true);
    expect(pairs.map((pair) => [pair.high?.fileName, pair.low?.fileName])).toEqual([
      ['dramatic_high.safetensors', 'dramatic_low.safetensors'],
      ['high_noise_model.safetensors', 'low_noise_model.safetensors'],
      ['YummyHD_HighNoise.safetensors', 'YummyHD_LowNoise.safetensors'],
    ]);
  });

  it('builds search text from filename, display name, and path', () => {
    const entry = lora('high_noise_model.safetensors', '/runpod-volume/loras/DR34/i2v/high_noise_model.safetensors', 'DR34 High');

    expect(getLoraSearchText(entry)).toContain('dr34');
    expect(getLoraSearchText(entry)).toContain('i2v');
    expect(getLoraSearchText(entry)).toContain('high_noise_model');
  });
});
