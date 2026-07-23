'use client';

import { useEffect, useState } from 'react';
import {
  getViewportFormFactor,
  type MobileViewportFormFactor,
} from '@/lib/mobile/viewportFormFactor';

function readTouchCapability() {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

function readCurrentFormFactor(): MobileViewportFormFactor {
  if (typeof window === 'undefined') return 'phone-portrait';
  return getViewportFormFactor({
    width: window.innerWidth,
    height: window.innerHeight,
    touch: readTouchCapability(),
  });
}

export function useViewportFormFactor() {
  const [formFactor, setFormFactor] = useState<MobileViewportFormFactor>(readCurrentFormFactor);

  useEffect(() => {
    const update = () => setFormFactor(readCurrentFormFactor());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return formFactor;
}
