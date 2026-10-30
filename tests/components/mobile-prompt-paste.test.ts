/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ initial: 'Original prompt', draft: false, write: vi.fn(), toast: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: fixture.push }) }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ showToast: fixture.toast }) }));
vi.mock('@/lib/context/StudioContext', () => ({ useStudio: () => ({ activeWorkspaceId: 'fixture' }) }));
vi.mock('@/lib/create/imagePromptHelper', () => ({ requestZImagePromptRewrite: vi.fn() }));
vi.mock('@/components/mobile/create/MobileCreateProvider', () => ({
  useMobileCreate: () => {
    const [prompt, setPrompt] = React.useState(fixture.initial);
    const [promptHelperInstruction, setPromptHelperInstruction] = React.useState('Saved instruction');
    return {
      currentModel: { id: 'krea2' }, prompt,
      setPrompt: (text: string) => { fixture.write(text); setPrompt(text); },
      promptHelperInstruction, setPromptHelperInstruction,
      promptWildcardSelections: {}, setPromptWildcardSelections: vi.fn(),
      isPromptHelperConfigured: false, isPromptHelperLoading: false,
      isPromptDraftSelected: fixture.draft, selectedPromptDocumentTitle: 'Draft',
      runSavedPromptHelperInstruction: vi.fn(),
    };
  },
}));
vi.mock('@/components/prompt-wildcards/PromptTemplateTextarea', () => ({
  default: ({ value, onChange }: { value: string; onChange: (text: string) => void }) => (
    React.createElement('textarea', { 'aria-label': 'Prompt text', value, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value) })
  ),
}));
import MobilePromptScreen from '@/components/mobile/create/MobilePromptScreen';

const paste = () => screen.getByRole('button', { name: 'Paste and replace prompt' });
const prompt = () => screen.getByRole('textbox', { name: 'Prompt text' }) as HTMLTextAreaElement;
const clipboard = (readText?: () => Promise<string>) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: readText ? { readText } : undefined });
beforeEach(() => { vi.clearAllMocks(); fixture.initial = 'Original prompt'; fixture.draft = false; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); clipboard(); });

describe('mobile prompt clipboard replacement', () => {
  it('reads only on click and replaces all text, preserving whitespace and newlines without focusing or navigating', async () => {
    const text = '  New prompt\nSecond line with {wildcard}  ';
    const read = vi.fn().mockResolvedValue(text); clipboard(read); render(React.createElement(MobilePromptScreen));
    expect(read).not.toHaveBeenCalled();
    fireEvent.click(paste());
    await waitFor(() => expect(prompt().value).toBe(text));
    expect(fixture.write).toHaveBeenCalledExactlyOnceWith(text);
    expect(document.activeElement).not.toBe(prompt());
    expect(fixture.push).not.toHaveBeenCalled();
    expect((screen.getAllByRole('textbox')[1] as HTMLTextAreaElement).value).toBe('Saved instruction');
  });
  it('is available when the prompt is empty', async () => {
    fixture.initial = ''; clipboard(vi.fn().mockResolvedValue('First prompt')); render(React.createElement(MobilePromptScreen));
    fireEvent.click(paste()); await waitFor(() => expect(prompt().value).toBe('First prompt'));
  });
  it('keeps pasted text on Save', async () => {
    clipboard(vi.fn().mockResolvedValue('Replacement')); render(React.createElement(MobilePromptScreen));
    fireEvent.click(paste()); await waitFor(() => expect(prompt().value).toBe('Replacement'));
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await waitFor(() => expect(fixture.push).toHaveBeenCalledWith('/m/create'));
    expect(prompt().value).toBe('Replacement');
  });
  it('restores the original prompt on Cancel', async () => {
    clipboard(vi.fn().mockResolvedValue('Replacement')); render(React.createElement(MobilePromptScreen));
    fireEvent.click(paste()); await waitFor(() => expect(prompt().value).toBe('Replacement'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(prompt().value).toBe('Original prompt');
    await waitFor(() => expect(fixture.push).toHaveBeenCalledWith('/m/create'));
  });
  it('keeps existing text when clipboard contains no text', async () => {
    clipboard(vi.fn().mockResolvedValue('')); render(React.createElement(MobilePromptScreen)); fireEvent.click(paste());
    await waitFor(() => expect(fixture.toast).toHaveBeenCalledWith('Clipboard has no text. Prompt unchanged.', 'info', 3000));
    expect(prompt().value).toBe('Original prompt'); expect(fixture.write).not.toHaveBeenCalled();
  });
  it('keeps existing text and explains manual paste when permission is denied', async () => {
    clipboard(vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))); render(React.createElement(MobilePromptScreen)); fireEvent.click(paste());
    await waitFor(() => expect(fixture.toast).toHaveBeenCalledWith(expect.stringContaining('Touch and hold'), 'error'));
    expect(prompt().value).toBe('Original prompt'); expect((paste() as HTMLButtonElement).disabled).toBe(false);
  });
  it('keeps existing text when clipboard API is unavailable', () => {
    clipboard(); render(React.createElement(MobilePromptScreen)); fireEvent.click(paste());
    expect(fixture.toast).toHaveBeenCalledWith(expect.stringContaining('unavailable'), 'info');
    expect(prompt().value).toBe('Original prompt');
  });
  it('disables duplicate requests and ignores a late result after Cancel', async () => {
    let resolve!: (value: string) => void;
    const read = vi.fn(() => new Promise<string>(done => { resolve = done; })); clipboard(read); render(React.createElement(MobilePromptScreen));
    fireEvent.click(paste()); expect((paste() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(paste()); expect(read).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true })); fixture.write.mockClear();
    await act(async () => resolve('Late clipboard text'));
    expect(fixture.write).not.toHaveBeenCalled(); expect(prompt().value).toBe('Original prompt');
    await waitFor(() => expect(fixture.push).toHaveBeenCalledWith('/m/create'));
  });
  it('ignores clipboard completion after the editor unmounts', async () => {
    let resolve!: (value: string) => void;
    clipboard(() => new Promise<string>(done => { resolve = done; })); const view = render(React.createElement(MobilePromptScreen));
    fireEvent.click(paste()); view.unmount(); await act(async () => resolve('Late text'));
    expect(fixture.write).not.toHaveBeenCalled(); expect(fixture.toast).not.toHaveBeenCalled();
  });
  it('does not offer manual paste for a selected prompt draft', () => {
    fixture.draft = true; const read = vi.fn(); clipboard(read); render(React.createElement(MobilePromptScreen));
    expect(screen.queryByRole('button', { name: 'Paste and replace prompt' })).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
