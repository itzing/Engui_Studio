/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PromptWildcardsDialog from '@/components/prompt-wildcards/PromptWildcardsDialog';

const wildcards = Array.from({ length: 40 }, (_, index) => ({
  id: `wildcard-${index}`,
  name: `Wildcard ${index}`,
  key: `wildcard${index}`,
  value: `variant ${index}`,
}));

describe('PromptWildcardsDialog layout', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, wildcards }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the New action outside the scrollable wildcard list', async () => {
    render(React.createElement(PromptWildcardsDialog, {
      open: true,
      workspaceId: 'default',
      onOpenChange: vi.fn(),
    }));

    await waitFor(() => expect(screen.getByText('Wildcard 39')).toBeTruthy());

    const newButton = screen.getByRole('button', { name: /new/i });
    const scrollArea = document.body.querySelector('aside .overflow-y-auto');

    expect(newButton.closest('aside')).toBeNull();
    expect(scrollArea).toBeTruthy();
    expect(scrollArea?.className).toContain('min-h-0');
    expect(scrollArea?.className).toContain('flex-1');
    expect(scrollArea?.className).toContain('overflow-y-auto');
  });
});
