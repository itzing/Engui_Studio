/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CREATE_DRAFT_STATE_STORAGE_KEY } from '@/lib/create/createDraftSchema';

const { mockAddJob, mockSetSelectedModel } = vi.hoisted(() => ({
  mockAddJob: vi.fn(),
  mockSetSelectedModel: vi.fn(),
}));

vi.mock('@/lib/context/StudioContext', () => ({
  useStudio: () => ({
    settings: {
      promptHelper: { provider: 'disabled', local: {} },
      apiKeys: {},
      runpod: { endpoints: {} },
    },
    addJob: mockAddJob,
    setSelectedModel: mockSetSelectedModel,
    activeWorkspaceId: 'ws-1',
  }),
}));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/lora/LoRAPairSelector', () => ({
  LoRAPairSelector: ({
    highWeight,
    lowWeight,
    onHighWeightChange,
    onLowWeightChange,
  }: {
    highWeight: number;
    lowWeight: number;
    onHighWeightChange: (weight: number) => void;
    onLowWeightChange: (weight: number) => void;
  }) => React.createElement(
    'div',
    null,
    React.createElement('input', {
      'aria-label': 'high-weight',
      value: highWeight,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onHighWeightChange(Number(event.target.value)),
    }),
    React.createElement('input', {
      'aria-label': 'low-weight',
      value: lowWeight,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onLowWeightChange(Number(event.target.value)),
    }),
  ),
}));

vi.mock('@/components/lora/LoRASelector', () => ({
  LoRASelector: () => null,
}));

vi.mock('@/components/lora/LoRAManagementDialog', () => ({
  LoRAManagementDialog: () => null,
}));

import VideoGenerationForm from '@/components/forms/VideoGenerationForm';
import { getModelById } from '@/lib/models/modelConfig';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response);
}

describe('VideoGenerationForm WAN22 LoRA weight persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));
  });

  it('saves edited WAN22 LoRA weights into the video draft and restores them after remount', async () => {
    const firstRender = render(React.createElement(VideoGenerationForm));

    const advancedButton = await screen.findByRole('button', { name: 'generationForm.advancedSettings' });
    fireEvent.click(advancedButton);

    const highInputs = await screen.findAllByLabelText('high-weight') as HTMLInputElement[];
    const lowInputs = await screen.findAllByLabelText('low-weight') as HTMLInputElement[];
    fireEvent.change(highInputs[0], { target: { value: '1' } });
    fireEvent.change(lowInputs[0], { target: { value: '1' } });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
      expect(stored.workflows.video.drafts.wan22.draft.parameterValues).toMatchObject({
        lora_high_1_weight: 1,
        lora_low_1_weight: 1,
      });
    });

    firstRender.unmount();
    render(React.createElement(VideoGenerationForm));

    const restoredAdvancedButton = await screen.findByRole('button', { name: 'generationForm.advancedSettings' });
    fireEvent.click(restoredAdvancedButton);

    await waitFor(() => {
      const restoredHighInputs = screen.getAllByLabelText('high-weight') as HTMLInputElement[];
      const restoredLowInputs = screen.getAllByLabelText('low-weight') as HTMLInputElement[];
      expect(restoredHighInputs[0].value).toBe('1');
      expect(restoredLowInputs[0].value).toBe('1');
    });
  });

  it('keeps WAN22 Create Video defaults at 4 steps and 80 frames', () => {
    const model = getModelById('wan22');
    expect(model?.parameters.find((param) => param.name === 'steps')?.default).toBe(4);
    expect(model?.parameters.find((param) => param.name === 'length')?.default).toBe(80);
    expect(model?.parameters.find((param) => param.name === 'length')?.min).toBeLessThanOrEqual(80);
  });

  it('does not apply browser step or range validation to Create Video dimensions', async () => {
    const { container } = render(React.createElement(VideoGenerationForm));

    await screen.findByRole('button', { name: 'generationForm.advancedSettings' });

    const widthInput = container.querySelector('input[name="width"]') as HTMLInputElement | null;
    const heightInput = container.querySelector('input[name="height"]') as HTMLInputElement | null;

    expect(widthInput?.getAttribute('step')).toBe('any');
    expect(widthInput?.getAttribute('min')).toBeNull();
    expect(widthInput?.getAttribute('max')).toBeNull();
    expect(heightInput?.getAttribute('step')).toBe('any');
    expect(heightInput?.getAttribute('min')).toBeNull();
    expect(heightInput?.getAttribute('max')).toBeNull();
  });
});
