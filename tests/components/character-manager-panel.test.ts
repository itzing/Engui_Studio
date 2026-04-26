/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockShowToast } = vi.hoisted(() => ({
  mockShowToast: vi.fn(),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

import CharacterManagerPanel from '@/components/characters/CharacterManagerPanel';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response);
}

describe('CharacterManagerPanel gender behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults a new desktop character draft to female', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/characters?includeDeleted=true')) {
        return jsonResponse({ success: true, characters: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(CharacterManagerPanel));

    await waitFor(() => {
      expect(screen.getByText('female')).toBeTruthy();
    });
  });

  it('uses a male/female toggle and saves gender-only changes', async () => {
    const character = {
      id: 'character-1',
      name: 'Mira',
      gender: 'male',
      traits: { hair_color: 'silver' },
      editorState: {},
      currentVersionId: 'version-1',
      previewStatusSummary: null,
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      deletedAt: null,
      versionCount: 1,
    };

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';

      if (method === 'GET' && url.includes('/api/characters?includeDeleted=true')) {
        return jsonResponse({ success: true, characters: [character] });
      }
      if (method === 'GET' && url.endsWith('/api/characters/character-1/versions')) {
        return jsonResponse({ success: true, versions: [] });
      }
      if (method === 'PUT' && url.endsWith('/api/characters/character-1')) {
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body.gender).toBe('female');
        return jsonResponse({ success: true, character: { ...character, gender: 'female' }, persisted: true });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(CharacterManagerPanel));

    await waitFor(() => {
      expect(screen.getByText('male')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.click(screen.getByTestId('character-manager-gender-toggle-female'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Character version saved', 'success');
    });
  });
});
