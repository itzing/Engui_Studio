/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PromptTemplateTextarea from '@/components/prompt-wildcards/PromptTemplateTextarea';
import { chooseBrowserWorkspace } from '@/lib/workspaces/client';
const id = '11111111-1111-4111-8111-111111111111';
const response = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const fetcher = vi.fn();
function Harness({ enabled = true, initial = '' }: { enabled?: boolean; initial?: string }) {
  const [value, setValue] = React.useState(initial);
  return React.createElement(PromptTemplateTextarea, { value, onChange: setValue, workspaceId: 'ws-1', enableCharacterReferences: enabled, previewSeed: 42, testId: 'prompt' });
}
beforeEach(() => {
  chooseBrowserWorkspace('ws-1');
  fetcher.mockReset().mockImplementation((url: string) => url.startsWith('/api/characters')
    ? response({ success: true, characters: [{ id, name: 'Alice' }] })
    : url === '/api/create/prompt-preview' ? response({ success: true, prompt: 'Alice, red hair, blue jacket' })
    : response({ success: true, wildcards: [] }));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('Create Character prompt editing', () => {
  it('is opt-in and never loads Characters for other editors', async () => {
    render(React.createElement(Harness, { enabled: false }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(screen.queryByText('Insert character')).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => url.startsWith('/api/characters'))).toBe(false);
  });
  it('inserts an identity tag via name autocomplete and keyboard', async () => {
    render(React.createElement(Harness));
    const textarea = screen.getByTestId('prompt') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{Ali', selectionStart: 4 } }); fireEvent.keyUp(textarea);
    await screen.findByRole('button', { name: /Alice.*Character/ });
    fireEvent.keyDown(textarea, { key: 'ArrowUp' }); fireEvent.keyDown(textarea, { key: 'Enter' });
    await waitFor(() => expect(textarea.value).toBe(`{character:${id}}`));
  });
  it('inserts a default-outfit tag through the picker at the selected range', async () => {
    render(React.createElement(Harness, { initial: 'A person sits.' }));
    const textarea = screen.getByTestId('prompt') as HTMLTextAreaElement;
    textarea.focus(); textarea.setSelectionRange(2, 8); fireEvent.select(textarea);
    fireEvent.click(screen.getByRole('button', { name: 'Insert character' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Include outfit' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Alice' }));
    await waitFor(() => expect(textarea.value).toBe(`A {character:${id}:withOutfit} sits.`));
  });
  it('previews without replacing the source template and sends seed/owner', async () => {
    const tag = `{character:${id}}`;
    render(React.createElement(Harness, { initial: tag }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview prompt' }));
    expect(await screen.findByTestId('character-prompt-preview')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('character-prompt-preview').textContent).toContain('red hair'));
    expect((screen.getByTestId('prompt') as HTMLTextAreaElement).value).toBe(tag);
    const call = fetcher.mock.calls.find(([url]) => url === '/api/create/prompt-preview')!;
    expect(JSON.parse(call[1].body)).toMatchObject({ prompt: tag, workspaceId: 'ws-1', seed: 42 });
  });
  it('shows server validation failures instead of an empty success preview', async () => {
    fetcher.mockImplementation((url: string) => url === '/api/create/prompt-preview'
      ? response({ success: false, error: 'A referenced character is unavailable.' }, 422)
      : response({ success: true, characters: [], wildcards: [] }));
    render(React.createElement(Harness, { initial: `{character:${id}}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview prompt' }));
    expect((await screen.findByRole('alert')).textContent).toContain('unavailable');
  });
});
