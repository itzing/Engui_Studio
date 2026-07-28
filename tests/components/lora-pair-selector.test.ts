/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoRAPairSelector, type LoRAFile } from '@/components/lora/LoRAPairSelector';

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const lora = (fileName: string, s3Path: string, targetOverride?: string | null): LoRAFile => ({
  id: s3Path,
  name: fileName.replace(/\.safetensors$/i, ''),
  fileName,
  s3Path,
  s3Url: `s3://${s3Path}`,
  fileSize: '1024',
  extension: '.safetensors',
  uploadedAt: '2026-07-28T00:00:00.000Z',
  targetOverride,
});

describe('LoRAPairSelector', () => {
  it('shows manually video-marked high-only LoRAs', () => {
    const highOnly = lora('single_high.safetensors', '/runpod-volume/loras/single_high.safetensors', 'video');
    const onHighChange = vi.fn();
    const onLowChange = vi.fn();

    render(React.createElement(LoRAPairSelector, {
      highValue: '',
      lowValue: '',
      highWeight: 0.8,
      lowWeight: 0.8,
      onHighChange,
      onLowChange,
      onHighWeightChange: vi.fn(),
      onLowWeightChange: vi.fn(),
      availableLoras: [highOnly],
      onManageClick: vi.fn(),
    }));

    fireEvent.click(screen.getByRole('button', { name: /loraManagement.selector.selectPair/ }));
    fireEvent.click(screen.getByRole('button', { name: /single.*high/i }));

    expect(onHighChange).toHaveBeenCalledWith('/runpod-volume/loras/single_high.safetensors');
    expect(onLowChange).not.toHaveBeenCalled();
  });
});
