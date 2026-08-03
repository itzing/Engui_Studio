/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocalModelAskDialog from '@/components/local-model/LocalModelAskDialog';

describe('LocalModelAskDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => 'Model answer',
    })));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submits a single request and copies the answer', async () => {
    render(React.createElement(LocalModelAskDialog, {
      open: true,
      onOpenChange: vi.fn(),
    }));

    fireEvent.change(screen.getByPlaceholderText('Ask anything...'), {
      target: { value: 'What should I do?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(screen.getByText('Model answer')).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith('/api/local-model/ask', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ prompt: 'What should I do?' }),
    }));

    fireEvent.click(screen.getByRole('button', { name: /copy answer/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Model answer'));
  });

  it('does not submit empty requests', () => {
    render(React.createElement(LocalModelAskDialog, {
      open: true,
      onOpenChange: vi.fn(),
    }));

    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(fetch).not.toHaveBeenCalled();
  });
});

