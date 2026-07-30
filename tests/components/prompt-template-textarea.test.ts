/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PromptTemplateTextarea from '@/components/prompt-wildcards/PromptTemplateTextarea';

const wildcards = [
  {
    id: 'wildcard-1',
    workspaceId: 'ws-1',
    key: 'hairColor',
    name: 'Hair color',
    value: '{black hair|brown hair|blonde hair}',
    variants: ['black hair', 'brown hair', 'blonde hair'],
    status: 'active',
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  },
  {
    id: 'wildcard-2',
    workspaceId: 'ws-1',
    key: 'eyeColor',
    name: 'Eye color',
    value: '{blue eyes|green eyes}',
    variants: ['blue eyes', 'green eyes'],
    status: 'active',
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  },
];

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response);
}

function Harness() {
  const [value, setValue] = React.useState('');
  return React.createElement(PromptTemplateTextarea, {
    value,
    onChange: setValue,
    workspaceId: 'ws-1',
    className: 'min-h-32 w-full',
    testId: 'prompt-template-textarea',
  });
}

describe('PromptTemplateTextarea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ success: true, wildcards })));
  });

  it('opens template autocomplete on brace input and inserts the selected key', async () => {
    render(React.createElement(Harness));

    const textarea = screen.getByTestId('prompt-template-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{ha', selectionStart: 3, selectionEnd: 3 } });
    fireEvent.keyUp(textarea);

    await screen.findByTestId('prompt-template-autocomplete');
    expect(screen.getByText('Hair color')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /hair color/i }));

    await waitFor(() => {
      expect(textarea.value).toBe('{hairColor}');
    });
  });

  it('lets an existing template token choose an indexed variant subset', async () => {
    function PrefilledHarness() {
      const [value, setValue] = React.useState('portrait with {hairColor}');
      const [promptWildcardSelections, setPromptWildcardSelections] = React.useState({});
      return React.createElement(PromptTemplateTextarea, {
        value,
        onChange: setValue,
        workspaceId: 'ws-1',
        promptWildcardSelections,
        onPromptWildcardSelectionsChange: setPromptWildcardSelections,
        className: 'min-h-32 w-full',
        testId: 'prompt-template-textarea',
      });
    }

    render(React.createElement(PrefilledHarness));

    await screen.findByTestId('prompt-template-token-list');
    fireEvent.click(screen.getByRole('button', { name: /\{hairColor\}/i }));
    fireEvent.click(screen.getByRole('button', { name: /brown hair/ }));

    const textarea = screen.getByTestId('prompt-template-textarea') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('portrait with {hairColor:1}');
    });
  });

  it('stores sequential mode and start index for selected variants', async () => {
    const observedSelections: unknown[] = [];
    function PrefilledHarness() {
      const [value, setValue] = React.useState('portrait with {hairColor}');
      const [promptWildcardSelections, setPromptWildcardSelections] = React.useState({});
      return React.createElement(PromptTemplateTextarea, {
        value,
        onChange: setValue,
        workspaceId: 'ws-1',
        promptWildcardSelections,
        onPromptWildcardSelectionsChange: (next) => {
          observedSelections.push(next);
          setPromptWildcardSelections(next);
        },
        className: 'min-h-32 w-full',
        testId: 'prompt-template-textarea',
      });
    }

    render(React.createElement(PrefilledHarness));

    await screen.findByTestId('prompt-template-token-list');
    fireEvent.click(screen.getByRole('button', { name: /\{hairColor\}/i }));
    fireEvent.click(screen.getByRole('button', { name: /black hair/ }));
    fireEvent.click(screen.getByRole('button', { name: /brown hair/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sequential' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Start index' }), { target: { value: '1' } });

    const textarea = screen.getByTestId('prompt-template-textarea') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('portrait with {hairColor:0,1}');
      expect(observedSelections.at(-1)).toMatchObject({
        hairColor: {
          indices: [0, 1],
          mode: 'sequential',
          startIndex: 1,
          cursor: 1,
        },
      });
    });
  });
});
