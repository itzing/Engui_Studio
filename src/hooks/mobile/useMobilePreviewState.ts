'use client';

import { useCallback, useEffect, useState } from 'react';
import { dispatchMobilePreview, normalizeMobilePreviewItem, readStoredMobilePreview, type MobilePreviewItem } from '@/lib/mobile/mobilePreview';

export function useMobilePreviewState() {
  const [preview, setPreviewState] = useState<MobilePreviewItem | null>(null);

  useEffect(() => {
    setPreviewState(readStoredMobilePreview());
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      setPreviewState(normalizeMobilePreviewItem(customEvent.detail));
    };

    window.addEventListener('jobHoverPreview', handler as EventListener);
    return () => window.removeEventListener('jobHoverPreview', handler as EventListener);
  }, []);

  const setPreview = useCallback((nextPreview: MobilePreviewItem | null) => {
    dispatchMobilePreview(nextPreview);
    setPreviewState(nextPreview);
  }, []);

  return {
    preview,
    setPreview,
    clearPreview: () => setPreview(null),
  };
}
