import { createVideoByteCache, type VideoByteLease } from './videoByteCache';

type PrefetchOptions = { src?: string; autoPlay?: boolean; prefetchUrls?: readonly string[]; prefetchScope?: string };
type SourceOwner = { update: (options: { src?: string; autoPlay?: boolean }) => void };

/** Select cached bytes only at source entry, never when a background fetch completes. */
export function createVideoPrefetch(video: HTMLVideoElement, owner: SourceOwner) {
  let cache: ReturnType<typeof createVideoByteCache> | null = null;
  let lease: VideoByteLease | null = null;
  let options: PrefetchOptions = {};
  let scope: string | undefined;
  let disposed = false;
  let userPaused = false;
  let timer: number | undefined;
  const doc = video.ownerDocument;
  const win = doc.defaultView;
  const pause = () => {
    if (timer !== undefined) win?.clearTimeout(timer);
    timer = undefined;
    cache?.setEnabled(false);
  };
  const buffered = () => {
    if (disposed || doc.visibilityState === 'hidden' || !options.src || video.readyState < 3 || video.getAttribute('src') !== (lease?.src ?? options.src)) return false;
    const remaining = Number.isFinite(video.duration) ? Math.max(0, video.duration - video.currentTime) : 2;
    for (let index = 0; index < video.buffered.length; index += 1) {
      if (video.buffered.start(index) <= video.currentTime && video.buffered.end(index) - video.currentTime >= Math.min(2, remaining)) return true;
    }
    return false;
  };
  const schedule = () => {
    if (!cache || timer !== undefined || !buffered()) return;
    timer = win?.setTimeout(() => {
      timer = undefined;
      if (buffered()) cache?.setEnabled(true);
    }, 300);
  };
  const onPause = () => {
    if (!video.error && video.readyState >= 2 && video.getAttribute('src') === (lease?.src ?? options.src)) userPaused = true;
  };
  const onPlay = () => { userPaused = false; };
  video.addEventListener('pause', onPause);
  video.addEventListener('play', onPlay);
  const onVisibility = () => doc.visibilityState === 'hidden' ? pause() : schedule();
  ['playing', 'canplay', 'progress', 'timeupdate'].forEach((event) => video.addEventListener(event, schedule));
  ['waiting', 'stalled', 'emptied', 'error'].forEach((event) => video.addEventListener(event, pause));
  doc.addEventListener('visibilitychange', onVisibility);
  win?.addEventListener('pagehide', pause);
  win?.addEventListener('pageshow', schedule);
  return {
    update(next: PrefetchOptions) {
      if (disposed) return;
      const enabled = next.prefetchUrls !== undefined;
      const reset = Boolean(cache) !== enabled || scope !== next.prefetchScope;
      const changed = reset || options.src !== next.src;
      const previousLease = changed ? lease : null;
      let previousCache: typeof cache = null;
      if (changed) { pause(); userPaused = false; }
      if (reset) {
        previousCache = cache;
        cache = enabled ? createVideoByteCache({ baseUrl: doc.baseURI }) : null;
        scope = next.prefetchScope;
      }
      options = next;
      if (changed) lease = cache && next.src ? cache.acquire(next.src) : null;
      owner.update({ src: lease?.src ?? next.src, autoPlay: next.autoPlay && !userPaused });
      // The owner has synchronously detached the old source before its Blob URL is revoked.
      previousLease?.release();
      previousCache?.dispose();
      const [following, previous] = next.prefetchUrls ?? [];
      cache?.setTargets([following, next.src, previous].filter((src): src is string => Boolean(src)));
      schedule();
    },
    fallback() {
      if (!lease?.cached || !options.src) return false;
      pause();
      const failedLease = lease;
      lease = null;
      owner.update({ src: options.src, autoPlay: options.autoPlay && !userPaused });
      failedLease.release();
      cache?.forget(options.src);
      return true;
    },
    dispose() {
      disposed = true; pause();
      video.removeEventListener('pause', onPause);
      video.removeEventListener('play', onPlay);
      ['playing', 'canplay', 'progress', 'timeupdate'].forEach((event) => video.removeEventListener(event, schedule));
      ['waiting', 'stalled', 'emptied', 'error'].forEach((event) => video.removeEventListener(event, pause));
      doc.removeEventListener('visibilitychange', onVisibility);
      win?.removeEventListener('pagehide', pause);
      win?.removeEventListener('pageshow', schedule);
      lease?.release(); cache?.dispose();
    },
  };
}
