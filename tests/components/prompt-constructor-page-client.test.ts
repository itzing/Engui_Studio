/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockShowToast, mockPush, mockLoadPromptBlocks, mockConsumeReuseDraft, mockPersistPromptIntoImageCreateDraft, mockAnnounceCreateModeChange } = vi.hoisted(() => ({
  mockShowToast: vi.fn(),
  mockPush: vi.fn(),
  mockLoadPromptBlocks: vi.fn(),
  mockConsumeReuseDraft: vi.fn(),
  mockPersistPromptIntoImageCreateDraft: vi.fn(() => ({ workflow: 'image', modelId: 'flux-dev', snapshot: {} })),
  mockAnnounceCreateModeChange: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/context/StudioContext', () => ({
  useStudio: () => ({ activeWorkspaceId: 'ws-1' }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/lib/prompt-constructor/providers', () => ({
  loadPromptBlocks: mockLoadPromptBlocks,
}));

vi.mock('@/lib/prompt-constructor/persistPromptConstructorReuseDraft', () => ({
  consumePromptConstructorReuseDraft: mockConsumeReuseDraft,
}));

vi.mock('@/lib/create/persistCreateReuseDraft', () => ({
  persistPromptIntoImageCreateDraft: mockPersistPromptIntoImageCreateDraft,
}));

vi.mock('@/lib/create/createModeEvents', () => ({
  announceCreateModeChange: mockAnnounceCreateModeChange,
}));

import PromptConstructorPageClient from '@/components/prompt-constructor/PromptConstructorPageClient';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response);
}

function buildSceneDocument(id: string, title: string) {
  return {
    id,
    workspaceId: 'ws-1',
    title,
    templateId: 'scene_template_v2',
    templateVersion: 1,
    state: {
      schemaVersion: 1,
      sceneSummary: {
        sceneType: 'dramatic reunion',
        mainEvent: 'two allies meet again',
        notes: '',
        tags: ['dramatic'],
      },
      characterSlots: [
        {
          id: 'char_1',
          label: 'Character A',
          role: 'hero',
          enabled: true,
          presetRef: { id: 'char-preset-1', name: 'Hero Base' },
          posePresetRef: { id: 'pose-preset-1', name: 'Reaching Forward' },
          fields: {
            nameOrRole: 'wanderer',
            ageBand: '',
            genderPresentation: 'female',
            appearance: 'white hair',
            useRandomCharacterAppearance: false,
            randomCharacterId: '',
            randomCharacterName: '',
            randomCharacterAppearance: '',
            outfit: 'travel cloak',
            expression: 'relieved',
            pose: 'reaching forward',
            localAction: 'stepping into light',
            props: [],
          },
          staging: {
            screenPosition: 'left',
            depthLayer: 'foreground',
            bodyOrientation: '',
            stance: '',
            relativePlacementNotes: '',
          },
        },
      ],
      characterRelations: [],
      composition: {
        shotSize: 'medium wide',
        cameraAngle: 'low angle',
        framing: 'asymmetric',
        subjectPlacement: 'left third',
        foregroundPriority: '',
        backgroundPriority: '',
      },
      environment: {
        location: 'ruined temple',
        timeOfDay: 'dusk',
        lighting: 'god rays',
        weather: '',
        background: 'collapsed hall',
        environmentDetails: '',
      },
      style: {
        medium: 'digital painting',
        visualStyle: 'cinematic fantasy',
        detailLevel: 'high detail',
        colorPalette: 'amber and teal',
        mood: 'hopeful',
        renderingStyle: 'z-image turbo',
      },
      constraints: {
        mustKeep: ['single frame'],
        mustAvoid: [],
        consistencyRequirements: [],
        layoutConstraints: [],
        textConstraints: [],
      },
    },
    enabledConstraintIds: [
      'consistent_anatomy',
      'no_extra_people',
      'no_duplicated_limbs',
      'clear_subject_focus',
      'clear_character_separation',
      'consistent_character_identity',
    ],
    status: 'active',
    createdAt: '2026-04-25T12:00:00.000Z',
    updatedAt: '2026-04-25T12:00:00.000Z',
  };
}

describe('PromptConstructorPageClient regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadPromptBlocks.mockResolvedValue([]);
    mockConsumeReuseDraft.mockReturnValue(null);
    mockPersistPromptIntoImageCreateDraft.mockClear();
    mockAnnounceCreateModeChange.mockClear();
    window.localStorage.clear();
    window.confirm = vi.fn(() => true);
  });

  it('loads a saved scene from summary list without crashing on missing summary state fields', async () => {
    const loadedDocument = buildSceneDocument('scene-1', 'Temple reunion');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/prompt-documents?workspaceId=ws-1')) {
        return jsonResponse({
          success: true,
          documents: [
            {
              id: 'scene-1',
              workspaceId: 'ws-1',
              title: 'Temple reunion',
              templateId: 'scene_template_v2',
              templateVersion: 1,
              status: 'active',
              createdAt: '2026-04-25T12:00:00.000Z',
              updatedAt: '2026-04-25T12:00:00.000Z',
              sceneType: 'dramatic reunion',
              tags: ['dramatic'],
              characterCount: 1,
              relationCount: 0,
            },
          ],
        });
      }
      if (url.endsWith('/api/prompt-documents/scene-1')) {
        return jsonResponse({ success: true, document: loadedDocument, warnings: [], renderedPrompt: 'Scene: dramatic reunion' });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(PromptConstructorPageClient));

    await screen.findByRole('option', { name: /Temple reunion/i });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'scene-1' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Temple reunion')).toBeTruthy();
    });

    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('restores the last opened saved draft automatically on open', async () => {
    const loadedDocument = buildSceneDocument('scene-last-opened', 'Last opened scene');
    window.localStorage.setItem('prompt-constructor:last-opened:ws-1', 'scene-last-opened');

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/prompt-documents?workspaceId=ws-1')) {
        return jsonResponse({
          success: true,
          documents: [
            {
              id: 'scene-last-opened',
              workspaceId: 'ws-1',
              title: 'Last opened scene',
              templateId: 'scene_template_v2',
              templateVersion: 1,
              status: 'active',
              createdAt: '2026-04-25T12:00:00.000Z',
              updatedAt: '2026-04-25T12:00:00.000Z',
              sceneType: 'dramatic reunion',
              tags: ['dramatic'],
              characterCount: 1,
              relationCount: 0,
            },
          ],
        });
      }
      if (url.endsWith('/api/prompt-documents/scene-last-opened')) {
        return jsonResponse({ success: true, document: loadedDocument, warnings: [], renderedPrompt: 'Scene: dramatic reunion' });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(PromptConstructorPageClient));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Last opened scene')).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/prompt-documents/scene-last-opened', { cache: 'no-store' });
  });

  it('shows preset refs as read-only badges while keeping pose editable', async () => {
    const loadedDocument = buildSceneDocument('scene-refs', 'Preset scene');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/prompt-documents?workspaceId=ws-1')) {
        return jsonResponse({
          success: true,
          documents: [
            {
              id: 'scene-refs',
              workspaceId: 'ws-1',
              title: 'Preset scene',
              templateId: 'scene_template_v2',
              templateVersion: 1,
              status: 'active',
              createdAt: '2026-04-25T12:00:00.000Z',
              updatedAt: '2026-04-25T12:00:00.000Z',
              sceneType: 'dramatic reunion',
              tags: ['dramatic'],
              characterCount: 1,
              relationCount: 0,
            },
          ],
        });
      }
      if (url.endsWith('/api/prompt-documents/scene-refs')) {
        return jsonResponse({ success: true, document: loadedDocument, warnings: [], renderedPrompt: 'Scene: dramatic reunion' });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(PromptConstructorPageClient));

    await screen.findByRole('option', { name: /Preset scene/i });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'scene-refs' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Preset scene')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));

    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.queryByText('Label')).toBeNull();
    expect(screen.getByTestId('character-preset-badge-char_1').textContent).toContain('Hero Base');
    expect(screen.getByTestId('pose-preset-badge-char_1').textContent).toContain('Reaching Forward');
    expect(screen.queryByDisplayValue('Hero Base')).toBeNull();
    expect(screen.queryByDisplayValue('Reaching Forward')).toBeNull();
    expect(screen.getByDisplayValue('reaching forward')).toBeTruthy();
  });

  it('uses a male/female toggle for gender and persists selection compatibly', async () => {
    const loadedDocument = buildSceneDocument('scene-gender', 'Gender scene');
    const saveResponseDocument = {
      ...loadedDocument,
      state: {
        ...loadedDocument.state,
        characterSlots: loadedDocument.state.characterSlots.map((slot) => ({
          ...slot,
          fields: {
            ...slot.fields,
            genderPresentation: 'male',
          },
        })),
      },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      if (method === 'GET' && url.includes('/api/prompt-documents?workspaceId=ws-1')) {
        return jsonResponse({
          success: true,
          documents: [{
            id: 'scene-gender',
            workspaceId: 'ws-1',
            title: 'Gender scene',
            templateId: 'scene_template_v2',
            templateVersion: 1,
            status: 'active',
            createdAt: '2026-04-25T12:00:00.000Z',
            updatedAt: '2026-04-25T12:00:00.000Z',
            sceneType: 'dramatic reunion',
            tags: ['dramatic'],
            characterCount: 1,
            relationCount: 0,
          }],
        });
      }
      if (method === 'GET' && url.endsWith('/api/prompt-documents/scene-gender')) {
        return jsonResponse({ success: true, document: loadedDocument, warnings: [], renderedPrompt: 'Scene: dramatic reunion' });
      }
      if (method === 'PUT' && url.endsWith('/api/prompt-documents/scene-gender')) {
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body.state.characterSlots[0].fields.genderPresentation).toBe('male');
        return jsonResponse({ success: true, document: saveResponseDocument, warnings: [] });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(PromptConstructorPageClient));

    await screen.findByRole('option', { name: /Gender scene/i });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'scene-gender' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Gender scene')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));
    expect(screen.queryByDisplayValue('female')).toBeNull();
    expect(screen.getByTestId('gender-toggle-female-char_1')).toBeTruthy();
    expect(screen.getByTestId('gender-toggle-male-char_1')).toBeTruthy();

    fireEvent.click(screen.getByTestId('gender-toggle-male-char_1'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Scene saved', 'success');
    });
  });

  it('shows Character Manager picks only for appearance and fills name plus appearance without character name or gender', async () => {
    const loadedDocument = buildSceneDocument('scene-character-helper', 'Character helper scene');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/prompt-documents?workspaceId=ws-1')) {
        return jsonResponse({
          success: true,
          documents: [{
            id: 'scene-character-helper',
            workspaceId: 'ws-1',
            title: 'Character helper scene',
            templateId: 'scene_template_v2',
            templateVersion: 1,
            status: 'active',
            createdAt: '2026-04-25T12:00:00.000Z',
            updatedAt: '2026-04-25T12:00:00.000Z',
            sceneType: 'dramatic reunion',
            tags: ['dramatic'],
            characterCount: 1,
            relationCount: 0,
          }],
        });
      }
      if (url.endsWith('/api/prompt-documents/scene-character-helper')) {
        return jsonResponse({ success: true, document: loadedDocument, warnings: [], renderedPrompt: 'Scene: dramatic reunion' });
      }
      if (url.endsWith('/api/characters')) {
        return jsonResponse({
          success: true,
          characters: [{
            id: 'character-mira',
            name: 'Mira',
            gender: 'female',
            traits: {
              skin_tone: 'pale skin',
              hair_color: 'silver hair',
              eye_color: 'green eyes',
            },
            editorState: {},
            currentVersionId: 'version-1',
            previewStatusSummary: null,
            createdAt: '2026-04-25T12:00:00.000Z',
            updatedAt: '2026-04-25T12:00:00.000Z',
            deletedAt: null,
          }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(PromptConstructorPageClient));

    await screen.findByRole('option', { name: /Character helper scene/i });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'scene-character-helper' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Character helper scene')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));
    expect(screen.getByText('Age')).toBeTruthy();
    expect(screen.getByDisplayValue('white hair')).toBeTruthy();

    fireEvent.focus(screen.getByDisplayValue('wanderer'));
    expect(screen.queryByTestId('select-character-character-mira')).toBeNull();
    expect(screen.getByText('No helper content for this character field yet.')).toBeTruthy();

    fireEvent.focus(screen.getByDisplayValue('white hair'));

    await screen.findByTestId('select-character-character-mira');
    expect(screen.getByText('Mira')).toBeTruthy();

    fireEvent.click(screen.getByTestId('select-character-character-mira'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Mira')).toBeTruthy();
    });

    const appearanceInput = screen.getByDisplayValue(/silver hair/i) as HTMLInputElement;
    expect(appearanceInput.value).toContain('silver hair');
    expect(appearanceInput.value).toContain('green eyes');
    expect(appearanceInput.value).not.toContain('female');
    expect(appearanceInput.value).not.toContain('Mira');
  });

  it('sends only the rendered prompt into Image Create without replacing the whole draft', async () => {
    const loadedDocument = buildSceneDocument('scene-open-in-create', 'Open in Create scene');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/prompt-documents?workspaceId=ws-1')) {
        return jsonResponse({
          success: true,
          documents: [{
            id: 'scene-open-in-create',
            workspaceId: 'ws-1',
            title: 'Open in Create scene',
            templateId: 'scene_template_v2',
            templateVersion: 1,
            status: 'active',
            createdAt: '2026-04-25T12:00:00.000Z',
            updatedAt: '2026-04-25T12:00:00.000Z',
            sceneType: 'dramatic reunion',
            tags: ['dramatic'],
            characterCount: 1,
            relationCount: 0,
          }],
        });
      }
      if (url.endsWith('/api/prompt-documents/scene-open-in-create')) {
        return jsonResponse({ success: true, document: loadedDocument, warnings: [], renderedPrompt: 'Scene: dramatic reunion' });
      }
      if (url.endsWith('/api/characters')) {
        return jsonResponse({ success: true, characters: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(PromptConstructorPageClient));

    await screen.findByRole('option', { name: /Open in Create scene/i });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'scene-open-in-create' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Open in Create scene')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Open in Create' })[0]);

    await waitFor(() => {
      expect(mockPersistPromptIntoImageCreateDraft).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringContaining('Character 1: wanderer'),
        sourcePromptDocumentId: 'scene-open-in-create',
        sourcePromptDocumentTitle: 'Open in Create scene',
      }));
    });

    expect(mockAnnounceCreateModeChange).toHaveBeenCalledWith('image');
    expect(mockShowToast).toHaveBeenCalledWith('Scene prompt sent to Image Create', 'success');
  });

  it('disables name and appearance and renders a random matching character when random is enabled', async () => {
    const loadedDocument = buildSceneDocument('scene-random', 'Random scene');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/prompt-documents?workspaceId=ws-1')) {
        return jsonResponse({
          success: true,
          documents: [{
            id: 'scene-random',
            workspaceId: 'ws-1',
            title: 'Random scene',
            templateId: 'scene_template_v2',
            templateVersion: 1,
            status: 'active',
            createdAt: '2026-04-25T12:00:00.000Z',
            updatedAt: '2026-04-25T12:00:00.000Z',
            sceneType: 'dramatic reunion',
            tags: ['dramatic'],
            characterCount: 1,
            relationCount: 0,
          }],
        });
      }
      if (url.endsWith('/api/prompt-documents/scene-random')) {
        return jsonResponse({ success: true, document: loadedDocument, warnings: [], renderedPrompt: 'Scene: dramatic reunion' });
      }
      if (url.endsWith('/api/characters')) {
        return jsonResponse({
          success: true,
          characters: [
            {
              id: 'character-female',
              name: 'Luna',
              gender: 'female',
              traits: { hair_color: 'silver hair', eye_color: 'amber eyes' },
              editorState: {},
              currentVersionId: 'version-f',
              previewStatusSummary: null,
              createdAt: '2026-04-25T12:00:00.000Z',
              updatedAt: '2026-04-25T12:00:00.000Z',
              deletedAt: null,
            },
            {
              id: 'character-male',
              name: 'Kai',
              gender: 'male',
              traits: { hair_color: 'black hair' },
              editorState: {},
              currentVersionId: 'version-m',
              previewStatusSummary: null,
              createdAt: '2026-04-25T12:00:00.000Z',
              updatedAt: '2026-04-25T12:00:00.000Z',
              deletedAt: null,
            },
          ],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(React.createElement(PromptConstructorPageClient));

    await screen.findByRole('option', { name: /Random scene/i });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'scene-random' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Random scene')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));
    fireEvent.click(screen.getByTestId('random-character-toggle-char_1'));

    await waitFor(() => {
      expect((screen.getByTestId('character-field-nameOrRole-char_1') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByTestId('character-field-appearance-char_1') as HTMLInputElement).disabled).toBe(true);
      expect(screen.getByText(/Using random character: Luna/i)).toBeTruthy();
    });
  });

  it('re-picks a new random matching character on each Open in Create click', async () => {
    const loadedDocument = buildSceneDocument('scene-random-open', 'Random open scene');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/prompt-documents?workspaceId=ws-1')) {
        return jsonResponse({
          success: true,
          documents: [{
            id: 'scene-random-open',
            workspaceId: 'ws-1',
            title: 'Random open scene',
            templateId: 'scene_template_v2',
            templateVersion: 1,
            status: 'active',
            createdAt: '2026-04-25T12:00:00.000Z',
            updatedAt: '2026-04-25T12:00:00.000Z',
            sceneType: 'dramatic reunion',
            tags: ['dramatic'],
            characterCount: 1,
            relationCount: 0,
          }],
        });
      }
      if (url.endsWith('/api/prompt-documents/scene-random-open')) {
        return jsonResponse({ success: true, document: loadedDocument, warnings: [], renderedPrompt: 'Scene: dramatic reunion' });
      }
      if (url.endsWith('/api/characters')) {
        return jsonResponse({
          success: true,
          characters: [
            {
              id: 'character-female-1',
              name: 'Luna',
              gender: 'female',
              traits: { hair_color: 'silver hair', eye_color: 'amber eyes' },
              editorState: {},
              currentVersionId: 'version-f1',
              previewStatusSummary: null,
              createdAt: '2026-04-25T12:00:00.000Z',
              updatedAt: '2026-04-25T12:00:00.000Z',
              deletedAt: null,
            },
            {
              id: 'character-female-2',
              name: 'Nova',
              gender: 'female',
              traits: { hair_color: 'black hair', eye_color: 'green eyes' },
              editorState: {},
              currentVersionId: 'version-f2',
              previewStatusSummary: null,
              createdAt: '2026-04-25T12:00:00.000Z',
              updatedAt: '2026-04-25T12:00:00.000Z',
              deletedAt: null,
            },
          ],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0);

    render(React.createElement(PromptConstructorPageClient));

    await screen.findByRole('option', { name: /Random open scene/i });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'scene-random-open' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Random open scene')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Characters/i }));
    fireEvent.click(screen.getByTestId('random-character-toggle-char_1'));

    await waitFor(() => {
      expect(screen.getByText(/Using random character: Luna/i)).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Open in Create' })[0]);

    await waitFor(() => {
      expect(mockPersistPromptIntoImageCreateDraft).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Using random character: Nova/i)).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Open in Create' })[0]);

    await waitFor(() => {
      expect(mockPersistPromptIntoImageCreateDraft).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/Using random character: Luna/i)).toBeTruthy();
    });

    expect(mockPersistPromptIntoImageCreateDraft.mock.calls[0]?.[0]?.prompt).toContain('Character 1: Nova');
    expect(mockPersistPromptIntoImageCreateDraft.mock.calls[1]?.[0]?.prompt).toContain('Character 1: Luna');
  });

  it('saves a new scene and stays stable after the summary reload', async () => {
    const savedDocument = buildSceneDocument('scene-new', 'Moonlit balcony');
    let listCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';

      if (method === 'GET' && url.includes('/api/prompt-documents?workspaceId=ws-1')) {
        listCalls += 1;
        return jsonResponse({
          success: true,
          documents: listCalls > 1
            ? [{
              id: 'scene-new',
              workspaceId: 'ws-1',
              title: 'Moonlit balcony',
              templateId: 'scene_template_v2',
              templateVersion: 1,
              status: 'active',
              createdAt: '2026-04-25T12:00:00.000Z',
              updatedAt: '2026-04-25T12:00:00.000Z',
              sceneType: 'dramatic reunion',
              tags: ['dramatic'],
              characterCount: 1,
              relationCount: 0,
            }]
            : [],
        });
      }

      if (method === 'POST' && url.endsWith('/api/prompt-documents')) {
        return jsonResponse({ success: true, document: savedDocument, warnings: [] }, true, 201);
      }

      if (method === 'GET' && url.endsWith('/api/prompt-documents/scene-new')) {
        return jsonResponse({ success: true, document: savedDocument, warnings: [], renderedPrompt: 'Scene: dramatic reunion' });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(PromptConstructorPageClient));

    const titleInput = await screen.findByDisplayValue('Untitled Scene');
    fireEvent.change(titleInput, { target: { value: 'Moonlit balcony' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Moonlit balcony')).toBeTruthy();
    });

    expect(mockShowToast).toHaveBeenCalledWith('Scene saved', 'success');
  });
});
