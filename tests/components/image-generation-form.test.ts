/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAddJob, mockSubmitImageGeneration } = vi.hoisted(() => ({
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
}));

vi.mock('@/lib/context/StudioContext', () => ({
  useStudio: () => ({
    settings: {
      promptHelper: { provider: 'disabled', local: {} },
      visionPromptHelper: { provider: 'disabled', local: {} },
      apiKeys: {},
      runpod: { endpoints: {} },
    },
    addJob: mockAddJob,
    activeWorkspaceId: 'ws-1',
  }),
}));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ t: (key: string) => key }),
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
    switchModel: vi.fn(),
    hasRestoredDraftRef: { current: true },
  }),
}));

vi.mock('@/components/lora/LoRASelector', () => ({
  LoRASelector: () => null,
}));

vi.mock('@/components/lora/LoRAManagementDialog', () => ({
  LoRAManagementDialog: () => null,
}));

vi.mock('@/lib/create/imagePromptHelper', () => ({
  requestImagePromptImprovement: vi.fn(),
  extractImagePromptFromDataUrl: vi.fn(),
}));

import ImageGenerationForm from '@/components/forms/ImageGenerationForm';

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
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
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

describe('ImageGenerationForm prompt draft selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('locks prompt editing for a selected draft and re-renders latest draft prompt on generate', async () => {
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
            createdAt: '2026-04-26T00:00:00.000Z',
            updatedAt: '2026-04-26T00:00:00.000Z',
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

    render(React.createElement(ImageGenerationForm));

    await waitFor(() => {
      expect(screen.getByTestId('image-create-prompt-draft-selector')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('image-create-prompt-draft-selector'), { target: { value: 'draft-1' } });

    await waitFor(() => {
      const textarea = screen.getByTestId('image-create-prompt-textarea') as HTMLTextAreaElement;
      expect(textarea.disabled).toBe(true);
      expect(textarea.value.length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'generationForm.generate' }));

    await waitFor(() => {
      expect(mockSubmitImageGeneration).toHaveBeenCalledTimes(1);
    });

    expect(mockSubmitImageGeneration.mock.calls[0]?.[0]?.prompt).toContain('second appearance');
  });
});
