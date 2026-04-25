/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockShowToast, mockPush, mockLoadPromptBlocks, mockConsumeReuseDraft } = vi.hoisted(() => ({
  mockShowToast: vi.fn(),
  mockPush: vi.fn(),
  mockLoadPromptBlocks: vi.fn(),
  mockConsumeReuseDraft: vi.fn(),
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
          presetRef: null,
          posePresetRef: null,
          fields: {
            nameOrRole: 'wanderer',
            ageBand: '',
            genderPresentation: '',
            appearance: 'white hair',
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
