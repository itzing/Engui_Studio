/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('@/lib/workspaces/useWorkspaceFetch', () => ({ useWorkspaceFetch: () => fetchMock }));
vi.mock('@/lib/context/StudioContext', () => ({ useStudio: () => ({ activeWorkspaceId: 'ws-a', settings: { promptHelper: { provider: 'local', local: { baseUrl: 'helper', model: 'text' } } } }) }));
import ImageVibeControls from '@/components/create/ImageVibeControls';
let resolveStrip: (response: Response) => void;
function Harness({ scope = 'ws-a/model-a', draft = false }: { scope?: string; draft?: boolean }) {
  const [prompt, setPrompt] = useState('Moody light. A red chair.');
  const [source, setSource] = useState(draft ? 'document-a' : '');
  const [vibe, setVibe] = useState('');
  const [busy, setBusy] = useState(false);
  return React.createElement('div', null,
    React.createElement('input', { 'aria-label': 'Prompt', value: prompt, onChange: (e: any) => setPrompt(e.target.value) }),
    React.createElement('output', { 'data-testid': 'source' }, source),
    React.createElement('output', { 'data-testid': 'busy' }, String(busy)),
    React.createElement(ImageVibeControls, { prompt, selectedVibeId: vibe, onSelect: setVibe, scopeKey: scope, sourceKey: source, onBusyChange: setBusy,
      onApplyPrompt: (next) => { setPrompt(next); setSource(''); return () => { setPrompt(prompt); setSource(source); }; },
    }));
}
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockImplementation((url: string) => url.includes('/strip')
    ? new Promise<Response>((resolve) => { resolveStrip = resolve; })
    : Promise.resolve(Response.json({ success: true, vibes: [{ id: 'v1', name: 'Calm', baseDescription: 'Soft light.', status: 'active' }, { id: 'trash', name: 'Trash', status: 'trash' }] })));
});
afterEach(cleanup);
async function loaded(props = {}) { const result = render(React.createElement(Harness, props)); await screen.findByRole('option', { name: 'Calm' }); return result; }
it('selects separately from prompt and shows only active Vibes', async () => {
  await loaded(); fireEvent.change(screen.getByLabelText('Vibe'), { target: { value: 'v1' } });
  expect((screen.getByLabelText('Prompt') as HTMLInputElement).value).toBe('Moody light. A red chair.');
  expect(screen.queryByRole('option', { name: 'Trash' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Vibe'), { target: { value: '' } });
  expect((screen.getByLabelText('Vibe') as HTMLSelectElement).value).toBe('');
});
it('cleans a manual copy, supports undo including draft linkage, and deduplicates taps', async () => {
  await loaded({ draft: true });
  const button = screen.getByRole('button', { name: 'Strip vibe' }); fireEvent.click(button); fireEvent.click(button);
  expect(fetchMock.mock.calls.filter(([url]) => url.includes('/strip'))).toHaveLength(1);
  await act(async () => resolveStrip(Response.json({ success: true, prompt: 'A red chair.' })));
  expect((screen.getByLabelText('Prompt') as HTMLInputElement).value).toBe('A red chair.');
  expect(screen.getByTestId('source').textContent).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect((screen.getByLabelText('Prompt') as HTMLInputElement).value).toBe('Moody light. A red chair.');
  expect(screen.getByTestId('source').textContent).toBe('document-a');
});
it('preserves new user edits when a cleanup completes late', async () => {
  await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Strip vibe' }));
  fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'New prompt' } });
  await act(async () => resolveStrip(Response.json({ success: true, prompt: 'Old result' })));
  expect((screen.getByLabelText('Prompt') as HTMLInputElement).value).toBe('New prompt');
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  expect(screen.getByTestId('busy').textContent).toBe('false');
});
it('ignores a late result after switching models/workspaces', async () => {
  const view = await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Strip vibe' }));
  view.rerender(React.createElement(Harness, { scope: 'ws-b/model-b' }));
  await act(async () => resolveStrip(Response.json({ success: true, prompt: 'Old result' })));
  expect((screen.getByLabelText('Prompt') as HTMLInputElement).value).toBe('Moody light. A red chair.');
});
it('retains the prompt and reports failures', async () => {
  await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Strip vibe' }));
  await act(async () => resolveStrip(Response.json({ success: false, error: 'Helper unavailable' }, { status: 502 })));
  expect(screen.getByText('Helper unavailable')).toBeTruthy();
  expect((screen.getByLabelText('Prompt') as HTMLInputElement).value).toBe('Moody light. A red chair.');
});
it('aborts pending cleanup on unmount', async () => {
  const view = await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Strip vibe' }));
  const signal = fetchMock.mock.calls.find(([url]) => url.includes('/strip'))![1].signal;
  view.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => resolveStrip(Response.json({ success: true, prompt: 'Old result' })));
});
