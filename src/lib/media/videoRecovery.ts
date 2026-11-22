import { VIDEO_PLAYBACK_REJECTED_EVENT } from './videoLifecycle';

export type VideoPlaybackIssue = 'error' | 'blocked' | 'timeout';
export const VIDEO_STALL_TIMEOUT_MS = 10_000;

/** Observes playback intent, but never starts/restarts media automatically. */
export function observeVideoRecovery(video: HTMLVideoElement, notify: (issue: VideoPlaybackIssue | null) => void) {
  const doc = video.ownerDocument;
  const win = doc.defaultView;
  let active = false;
  let expectingPlayback = false;
  let suspended = doc.visibilityState === 'hidden';
  let disposed = false;
  let issue: VideoPlaybackIssue | null = null;
  let lastTime = video.currentTime;
  let lastProgress = Date.now();
  const visible = () => !disposed && !suspended && doc.visibilityState !== 'hidden';
  const setIssue = (next: VideoPlaybackIssue | null) => {
    if (disposed || next === issue) return;
    issue = next; notify(next);
  };
  const resetClock = () => { lastTime = video.currentTime; lastProgress = Date.now(); };
  const onPlaying = () => {
    if (!active || !visible()) return;
    expectingPlayback = true; resetClock(); setIssue(null);
  };
  const onProgress = () => {
    if (video.currentTime === lastTime) return;
    resetClock();
    if (active && visible()) setIssue(null);
  };
  const onPause = () => {
    // A ready, intentionally paused player is not a failed startup. Never resume it here.
    if (visible() && !video.error && video.readyState >= 2) expectingPlayback = false;
  };
  const onError = () => {
    // ManagedVideo may synchronously recover a failed cached Blob via its native URL.
    queueMicrotask(() => { if (active && visible() && video.error) setIssue('error'); });
  };
  const onRejected = () => { if (active && visible()) setIssue('blocked'); };
  const onLoad = () => {
    resetClock();
    if (video.autoplay || !video.paused) expectingPlayback = true;
  };
  const onHide = () => { suspended = true; resetClock(); };
  const onShow = () => {
    suspended = doc.visibilityState === 'hidden'; resetClock();
    // The owner restores the pre-background playback intent before this listener runs.
    expectingPlayback = active && (video.autoplay || !video.paused);
  };
  const onVisibility = () => doc.visibilityState === 'hidden' ? onHide() : onShow();
  const handlers: Record<string, EventListener> = {
    play: onPlaying, playing: onPlaying, timeupdate: onProgress, pause: onPause,
    error: onError, loadstart: onLoad, emptied: onLoad,
    [VIDEO_PLAYBACK_REJECTED_EVENT]: onRejected,
  };
  Object.entries(handlers).forEach(([event, handler]) => video.addEventListener(event, handler));
  doc.addEventListener('visibilitychange', onVisibility);
  win?.addEventListener('pagehide', onHide);
  win?.addEventListener('pageshow', onShow);
  const timer = win?.setInterval(() => {
    if (!active || !visible() || !expectingPlayback || video.ended || !video.hasAttribute('src')) return;
    onProgress();
    if (!issue && Date.now() - lastProgress >= VIDEO_STALL_TIMEOUT_MS) setIssue('timeout');
  }, 1000);
  return {
    update(src: string | undefined, autoPlay: boolean) {
      active = Boolean(src); expectingPlayback = active && autoPlay;
      resetClock(); setIssue(null);
    },
    retry() { expectingPlayback = active; resetClock(); setIssue(null); },
    dispose() {
      disposed = true;
      if (timer !== undefined) win?.clearInterval(timer);
      Object.entries(handlers).forEach(([event, handler]) => video.removeEventListener(event, handler));
      doc.removeEventListener('visibilitychange', onVisibility);
      win?.removeEventListener('pagehide', onHide);
      win?.removeEventListener('pageshow', onShow);
    },
  };
}
