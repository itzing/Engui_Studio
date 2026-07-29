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

  it('uses a solid panel background and desktop-centered positioning', () => {
    render(
      React.createElement(LoRAHelperPopover, {
        profile: {
          id: 'profile-id',
          scope: 'single',
          loraId: 'lora-id',
          notes: 'trigger words',
        },
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open LoRA helper' }));

    const panel = screen.getByText('LoRA helper').parentElement;
    expect(panel?.className).toContain('bg-slate-950');
    expect(panel?.className).toContain('md:fixed');
    expect(panel?.className).toContain('md:left-1/2');
    expect(panel?.className).toContain('md:top-1/2');
  });
});
