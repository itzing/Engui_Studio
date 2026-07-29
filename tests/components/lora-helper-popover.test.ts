/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoRAHelperPopover } from '@/components/lora/LoRAHelperPopover';

describe('LoRAHelperPopover', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('splits notes by blank lines and copies a clicked group', async () => {
    render(
      React.createElement(LoRAHelperPopover, {
        profile: {
          id: 'profile-id',
          scope: 'single',
          loraId: 'lora-id',
          notes: 'first trigger\nline\n\nsecond prompt',
        },
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open LoRA helper' }));
    fireEvent.click(screen.getByRole('button', { name: /first trigger/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('first trigger\nline');
    });
  });

  it('applies recommended pair weights only after explicit click', () => {
    const onApplyWeights = vi.fn();

    render(
      React.createElement(LoRAHelperPopover, {
        profile: {
          id: 'profile-id',
          scope: 'pair',
          highLoraId: 'high-id',
          lowLoraId: 'low-id',
          notes: '',
          recommendedHighWeight: 0.6,
          recommendedLowWeight: 0.9,
        },
        onApplyWeights,
      })
    );

    expect(onApplyWeights).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open LoRA helper' }));
    fireEvent.click(screen.getByRole('button', { name: /apply recommended weights/i }));

    expect(onApplyWeights).toHaveBeenCalledWith({ high: '0.6', low: '0.9' });
  });
});
