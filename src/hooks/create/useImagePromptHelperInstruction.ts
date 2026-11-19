'use client';

import { useCallback, useEffect, useState } from 'react';
import { workspaceStorage, workspaceStorageKey } from '@/lib/workspaces/client';

const INSTRUCTION_KEY = 'engui:prompt-helper:instruction';

/** Restore on mount, but persist only explicit edits — never the initial empty state. */
export function useImagePromptHelperInstruction(workspaceId: string | null) {
  const [snapshot, setSnapshot] = useState<{ workspaceId: string | null; value: string }>({
    workspaceId: null,
    value: '',
  });

  useEffect(() => {
    const restore = () => {
      try {
        setSnapshot({ workspaceId, value: workspaceStorage(workspaceId)?.getItem(INSTRUCTION_KEY) ?? '' });
      } catch (error) {
        console.warn('Failed to restore prompt helper instruction', error);
      }
    };
    restore();

    if (!workspaceId || typeof window === 'undefined') return;
    const key = workspaceStorageKey(INSTRUCTION_KEY, workspaceId);
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === key || event.key === null)) restore();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [workspaceId]);

  const setInstruction = useCallback((value: string) => {
    if (!workspaceId) return;
    setSnapshot({ workspaceId, value });
    try {
      // Bind writes to this form's workspace, not mutable global workspace state.
      const storage = workspaceStorage(workspaceId);
      if (value.trim()) storage?.setItem(INSTRUCTION_KEY, value);
      else storage?.removeItem(INSTRUCTION_KEY);
    } catch (error) {
      console.warn('Failed to persist prompt helper instruction', error);
    }
  }, [workspaceId]);

  return [snapshot.workspaceId === workspaceId ? snapshot.value : '', setInstruction] as const;
}
