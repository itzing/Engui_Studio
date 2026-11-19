/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useImagePromptHelperInstruction } from '@/hooks/create/useImagePromptHelperInstruction';
import { chooseBrowserWorkspace, workspaceStorageKey } from '@/lib/workspaces/client';

const key = (id: string) => workspaceStorageKey('engui:prompt-helper:instruction', id);
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); chooseBrowserWorkspace('a'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('shared image instruction storage', () => {
  it('writes immediately even when an edit is followed by unmount in the same action', () => {
    const view = renderHook(() => useImagePromptHelperInstruction('a'));
    act(() => { view.result.current[1]('Last edit before leaving'); view.unmount(); });
    expect(localStorage.getItem(key('a'))).toBe('Last edit before leaving');
  });

  it('observes another tab without echoing writes, including explicit removal', () => {
    localStorage.setItem(key('a'), 'Original');
    const view = renderHook(() => useImagePromptHelperInstruction('a'));
    localStorage.setItem(key('a'), 'From another tab');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: key('a'), storageArea: localStorage })));
    expect(view.result.current[0]).toBe('From another tab');
    expect(write).not.toHaveBeenCalled();
    localStorage.removeItem(key('a'));
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: key('a'), storageArea: localStorage })));
    expect(view.result.current[0]).toBe('');
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not let a stale callback write into the newly selected workspace', () => {
    const view = renderHook(({ workspace }) => useImagePromptHelperInstruction(workspace), { initialProps: { workspace: 'a' } });
    const previousSetter = view.result.current[1];
    localStorage.setItem(key('b'), 'B instruction');
    chooseBrowserWorkspace('b'); view.rerender({ workspace: 'b' });
    act(() => previousSetter('A instruction'));
    expect(localStorage.getItem(key('a'))).toBe('A instruction');
    expect(localStorage.getItem(key('b'))).toBe('B instruction');
  });

  it('keeps the previous persisted text if saving fails, and keeps the edited text in the form', () => {
    localStorage.setItem(key('a'), 'Saved before quota failure');
    const view = renderHook(() => useImagePromptHelperInstruction('a'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    act(() => view.result.current[1]('Unsaved edited text'));
    expect(view.result.current[0]).toBe('Unsaved edited text');
    expect(localStorage.getItem(key('a'))).toBe('Saved before quota failure');
  });

  it('does not write before a workspace is selected', () => {
    const view = renderHook(() => useImagePromptHelperInstruction(null));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    act(() => view.result.current[1]('Unscoped instruction'));
    expect(write).not.toHaveBeenCalled();
    expect(view.result.current[0]).toBe('');
  });
});
