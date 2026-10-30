'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';

export function usePromptClipboardPaste({
  scopeKey,
  onPaste,
  manualPasteHint = 'Touch and hold the prompt field to paste.',
}: {
  scopeKey: string;
  onPaste: (text: string) => void;
  manualPasteHint?: string;
}) {
  const { showToast } = useToast();
  const [isPasting, setIsPasting] = useState(false);
  const requestRef = useRef(0);
  const busyRef = useRef(false);

  const cancelPaste = useCallback(() => {
    requestRef.current += 1;
    busyRef.current = false;
    setIsPasting(false);
  }, []);

  useEffect(() => {
    busyRef.current = false;
    setIsPasting(false);
    return () => {
      requestRef.current += 1;
      busyRef.current = false;
    };
  }, [scopeKey]);

  const pastePrompt = async () => {
    if (busyRef.current) return;
    const request = ++requestRef.current;
    if (typeof navigator.clipboard?.readText !== 'function') {
      showToast(`Clipboard access is unavailable. ${manualPasteHint}`, 'info');
      return;
    }
    busyRef.current = true;
    setIsPasting(true);
    try {
      // Keep the read inside the tap gesture; Safari must not wait for a permission preflight.
      const text = await navigator.clipboard.readText();
      if (request !== requestRef.current) return;
      if (text.length === 0) {
        showToast('Clipboard has no text. Prompt unchanged.', 'info', 3000);
        return;
      }
      onPaste(text);
    } catch {
      if (request === requestRef.current) showToast(`Cannot read clipboard. ${manualPasteHint}`, 'error');
    } finally {
      if (request === requestRef.current) {
        busyRef.current = false;
        setIsPasting(false);
      }
    }
  };

  return { isPasting, pastePrompt, cancelPaste };
}
