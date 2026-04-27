/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAddJob, mockSubmitImageGeneration, mockSwitchModel } = vi.hoisted(() => ({
  mockAddJob: vi.fn(),
  mockSubmitImageGeneration: vi.fn(async (params: any) => ({
    success: true,
    job: {
      id: 'job-1',
      modelId: 'mock-image',
      type: 'image',
      status: 'queued',
      prompt: params.prompt,
      createdAt: Date.now(),
      options: {},
    },
    nextSeed: null,
  })),
  mockSwitchModel: vi.fn(),
}));

vi.mock('@/lib/context/StudioContext', () => ({
  useStudio: () => ({
    settings: {
      promptHelper: { provider: 'disabled', local: {} },
      apiKeys: {},
      runpod: { endpoints: {} },
    },
    addJob: mockAddJob,
    activeWorkspaceId: 'ws-1',
  }),
}));

const mockModel = {
  id: 'mock-image',
  name: 'Mock Image',
  provider: 'test',
  type: 'image',
  inputs: ['text'],
  optionalInputs: [],
  parameters: [],
  capabilities: {},
  api: { type: 'runpod', endpoint: 'endpoint-1' },
};

vi.mock('@/lib/models/modelConfig', () => ({
  getModelsByType: () => [mockModel],
  getModelById: (id: string) => (id === 'mock-image' ? mockModel : null),
  isInputVisible: () => false,
}));

vi.mock('@/lib/create/submitImageGeneration', () => ({
  submitImageGeneration: mockSubmitImageGeneration,
}));

vi.mock('@/hooks/create/useImageCreateDraftPersistence', () => ({
  useImageCreateDraftPersistence: () => ({
    hydrateSnapshot: vi.fn(),
    switchModel: mockSwitchModel,
    hasRestoredDraftRef: { current: true },
  }),
}));

vi.mock('@/lib/create/imagePromptHelper', () => ({
  requestImagePromptImprovement: vi.fn(),
}));

vi.mock('@/lib/create/createMediaStore', () => ({
  storeCreateFile: vi.fn(),
  resolveCreateMediaRefToFile: vi.fn(),
}));

import { useImageCreateState } from '@/hooks/create/useImageCreateState';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response);
}

function buildSceneDocument(appearance: string) {
  return {
    id: 'draft-1',
    workspaceId: 'ws-1',
    title: 'Scene Draft',
    templateId: 'scene_template_v2',
    templateVersion: 1,
    status: 'active',
    createdAt: '2026-04-27T00:00:00.000Z',
    updatedAt: '2026-04-27T00:00:00.000Z',
    enabledConstraintIds: [],
    state: {
      schemaVersion: 1,
      sceneSummary: {
        sceneType: 'portrait scene',
        mainEvent: 'single character close-up',
        notes: '',
        tags: [],
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
            nameOrRole: 'Mira',
            ageBand: '22',
            genderPresentation: 'female',
            appearance,
            useRandomCharacterAppearance: false,
            randomCharacterId: '',
            randomCharacterName: '',
            randomCharacterAppearance: '',
            outfit: 'black coat',
            expression: 'calm',
            pose: 'looking forward',
            localAction: 'standing still',
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
        shotSize: '',
        cameraAngle: '',
        framing: '',
        subjectPlacement: '',
        foregroundPriority: '',
        backgroundPriority: '',
      },
      environment: {
        location: '',
        timeOfDay: '',
        lighting: '',
        weather: '',
        background: '',
        environmentDetails: '',
      },
      style: {
        medium: '',
        visualStyle: '',
        detailLevel: '',
        colorPalette: '',
        mood: '',
        renderingStyle: '',
      },
      constraints: {
        mustKeep: [],
        mustAvoid: [],
        consistencyRequirements: [],
        layoutConstraints: [],
        textConstraints: [],
      },
    },
  };
}

function Harness() {
  const state = useImageCreateState();

  return React.createElement(
    'div',
    null,
    React.createElement('div', { 'data-testid': 'prompt' }, state.prompt),
    React.createElement('div', { 'data-testid': 'selected-title' }, state.selectedPromptDocumentTitle),
    React.createElement('button', { type: 'button', onClick: () => state.selectPromptDocument('draft-1') }, 'Select draft'),
    React.createElement('button', { type: 'button', onClick: () => void state.submit() }, 'Submit'),
  );
}

describe('useImageCreateState mobile prompt draft flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-renders the selected prompt draft on every submit', async () => {
    let detailFetchCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/prompt-documents?workspaceId=ws-1')) {
        return jsonResponse({
          success: true,
          documents: [{
            id: 'draft-1',
            workspaceId: 'ws-1',
            title: 'Scene Draft',
            templateId: 'scene_template_v2',
            templateVersion: 1,
            status: 'active',
            createdAt: '2026-04-27T00:00:00.000Z',
            updatedAt: '2026-04-27T00:00:00.000Z',
          }],
        });
      }
      if (url.endsWith('/api/prompt-documents/draft-1')) {
        detailFetchCount += 1;
        return jsonResponse({
          success: true,
          document: buildSceneDocument(detailFetchCount === 1 ? 'first appearance' : 'second appearance'),
          renderedPrompt: '',
          warnings: [],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(Harness));

    fireEvent.click(screen.getByRole('button', { name: 'Select draft' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-title').textContent).toContain('Scene Draft');
      expect(screen.getByTestId('prompt').textContent).toContain('first appearance');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(mockSubmitImageGeneration).toHaveBeenCalledTimes(1);
    });

    expect(mockSubmitImageGeneration.mock.calls[0]?.[0]?.prompt).toContain('second appearance');
    expect(mockSubmitImageGeneration.mock.calls[0]?.[0]?.sourcePromptDocumentTitle).toBe('Scene Draft');
  });
});
