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

import CharacterManagerPanel, { parseImportText } from '@/components/characters/CharacterManagerPanel';

function buildPreviewState(overrides: Record<string, any> = {}) {
  return {
    portrait: {
      slot: 'portrait',
      status: 'idle',
      jobId: null,
      imageUrl: null,
      previewUrl: null,
      thumbnailUrl: null,
      error: null,
      promptSnapshot: null,
      updatedAt: null,
      ...(overrides.portrait || {}),
    },
    upper_body: {
      slot: 'upper_body',
      status: 'idle',
      jobId: null,
      imageUrl: null,
      previewUrl: null,
      thumbnailUrl: null,
      error: null,
      promptSnapshot: null,
      updatedAt: null,
      ...(overrides.upper_body || {}),
    },
    full_body: {
      slot: 'full_body',
      status: 'idle',
      jobId: null,
      imageUrl: null,
      previewUrl: null,
      thumbnailUrl: null,
      error: null,
      promptSnapshot: null,
      updatedAt: null,
      ...(overrides.full_body || {}),
    },
  };
}

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

  it('parses free-text male imports correctly instead of falling back to female', () => {
    const parsed = parseImportText('man named alaric, having northern european ethnicity, fair porcelain skin tone, rectangular face shape');

    expect(parsed.name).toBe('Alaric');
    expect(parsed.gender).toBe('male');
  });

  it('uses a male/female toggle and saves gender-only changes', async () => {
    const character = {
      id: 'character-1',
      name: 'Mira',
      gender: 'male',
      traits: { hair_color: 'silver' },
      editorState: {},
      previewState: buildPreviewState(),
      primaryPreviewImageUrl: null,
      primaryPreviewThumbnailUrl: null,
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


  it('lets users edit age in the basics UI and saves it as a character trait', async () => {
    const character = {
      id: 'character-1',
      name: 'Mira',
      gender: 'female',
      traits: { hair_color: 'silver' },
      editorState: {},
      previewState: buildPreviewState(),
      primaryPreviewImageUrl: null,
      primaryPreviewThumbnailUrl: null,
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
        expect(body.traits.age).toBe('25');
        return jsonResponse({ success: true, character: { ...character, traits: { ...character.traits, age: '25' } }, persisted: true });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(CharacterManagerPanel));

    await waitFor(() => {
      expect(screen.getByText('Not set')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(screen.getByTestId('character-manager-age-input'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Character version saved', 'success');
    });
  });

  it('queues a portrait preview from the saved character record', async () => {
    const character = {
      id: 'character-1',
      name: 'Mira',
      gender: 'female',
      traits: { hair_color: 'silver' },
      editorState: {},
      previewState: buildPreviewState(),
      primaryPreviewImageUrl: null,
      primaryPreviewThumbnailUrl: null,
      currentVersionId: 'version-1',
      previewStatusSummary: null,
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      deletedAt: null,
      versionCount: 1,
    };

    const queuedCharacter = {
      ...character,
      previewState: buildPreviewState({
        portrait: {
          status: 'queued',
          jobId: 'job-preview-1',
          promptSnapshot: 'portrait prompt',
          updatedAt: '2026-05-07T10:00:00.000Z',
        },
      }),
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
      if (method === 'POST' && url.endsWith('/api/characters/character-1/preview')) {
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body.slot).toBe('portrait');
        return jsonResponse({ success: true, jobId: 'job-preview-1', character: queuedCharacter });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(CharacterManagerPanel));

    await waitFor(() => {
      expect(screen.getByText('Portrait preview')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Generate' })[0]);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Character preview generation started', 'success');
    });

    expect(screen.getAllByText('Queued').length).toBeGreaterThan(0);
  });
});
