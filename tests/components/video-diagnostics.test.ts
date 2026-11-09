/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest';
import { getVideoDiagnostics, observeVideoDiagnostics, VIDEO_DIAGNOSTICS_KEY } from '@/lib/media/videoDiagnostics';
afterEach(() => vi.useRealTimers());
it('bounds local records, excludes URLs and detects stalled progress without restarting playback', () => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  const video = document.createElement('video'); video.src = 'https://private.invalid/secret-token.mp4';
  Object.defineProperty(video, 'paused', { configurable: true, value: false });
  const observer = observeVideoDiagnostics(video);
  for (let i = 0; i < 200; i++) observer.record('test');
  expect(getVideoDiagnostics()).toHaveLength(160);
  vi.advanceTimersByTime(12000);
  const saved = sessionStorage.getItem(VIDEO_DIAGNOSTICS_KEY)!;
  expect(saved).toContain('no-progress');
  expect(saved).not.toContain('private.invalid'); expect(saved).not.toContain('secret-token');
  expect(JSON.parse(saved).length).toBeLessThanOrEqual(80);
  observer.dispose(); const length = getVideoDiagnostics().length;
  vi.advanceTimersByTime(60000); expect(getVideoDiagnostics()).toHaveLength(length);
  delete (document as unknown as { visibilityState?: string }).visibilityState;
});
