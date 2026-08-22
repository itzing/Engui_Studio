/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CREATE_REUSE_DRAFT_EVENT } from '@/lib/create/createModeEvents';
import { useImageCreateDraftPersistence } from '@/hooks/create/useImageCreateDraftPersistence';

const {
  getWorkflowActiveModel,
  getWorkflowDraft,
  saveWorkflowDraft,
  setWorkflowActiveModel,
} = vi.hoisted(() => ({
  getWorkflowActiveModel: vi.fn(),
  getWorkflowDraft: vi.fn(),
  saveWorkflowDraft: vi.fn(),
  setWorkflowActiveModel: vi.fn(),
}));

vi.mock('@/lib/createDrafts', () => ({
  getWorkflowActiveModel,
  getWorkflowDraft,
  saveWorkflowDraft,
  setWorkflowActiveModel,
}));

vi.mock('@/lib/models/modelConfig', () => ({
  getModelById: (id: string) => ({
    id,
    parameters: [{ name: 'seed', default: 42 }],
  }),
  isInputVisible: () => false,
}));

describe('useImageCreateDraftPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkflowActiveModel.mockReturnValue('z-image');
    getWorkflowDraft.mockImplementation((_workflow: string, modelId: string) => (
      modelId === 'z-image'
        ? { prompt: 'initial', randomizeSeed: false, parameterValues: { seed: 42 } }
        : { prompt: 'reused', randomizeSeed: true, parameterValues: { seed: 12345 } }
    ));
  });

  it('hydrates a mounted image form when a reuse draft replaces storage', async () => {
    const setSelectedModel = vi.fn();
    const applySnapshot = vi.fn();

    function Harness({ snapshot }: { snapshot: { prompt: string; randomizeSeed: boolean; parameterValues: { seed: number } } }) {
      useImageCreateDraftPersistence({
        defaultModelId: 'z-image',
        selectedModel: 'z-image',
        setSelectedModel,
        snapshot,
        applySnapshot,
      });
      return null;
    }

    const { rerender } = render(React.createElement(Harness, {
      snapshot: { prompt: 'current', randomizeSeed: false, parameterValues: { seed: 42 } },
    }));

    await waitFor(() => {
      expect(applySnapshot).toHaveBeenCalledWith('z-image', expect.objectContaining({
        prompt: 'initial',
        randomizeSeed: false,
      }));
    });
    saveWorkflowDraft.mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent(CREATE_REUSE_DRAFT_EVENT, {
        detail: {
          workflow: 'image',
          modelId: 'flux-krea',
          token: 1,
        },
      }));
    });
    rerender(React.createElement(Harness, {
      snapshot: { prompt: 'stale current', randomizeSeed: false, parameterValues: { seed: 42 } },
    }));

    await waitFor(() => {
      expect(setWorkflowActiveModel).toHaveBeenCalledWith('image', 'flux-krea');
      expect(setSelectedModel).toHaveBeenCalledWith('flux-krea');
      expect(applySnapshot).toHaveBeenCalledWith('flux-krea', expect.objectContaining({
        prompt: 'reused',
        randomizeSeed: true,
        parameterValues: expect.objectContaining({ seed: 12345 }),
      }));
    });
    expect(saveWorkflowDraft).not.toHaveBeenCalledWith('image', 'z-image', expect.objectContaining({
      prompt: 'stale current',
      randomizeSeed: false,
    }));
  });
});
