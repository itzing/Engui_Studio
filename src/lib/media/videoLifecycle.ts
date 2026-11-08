type VideoOptions = { src?: string; autoPlay?: boolean };

type VideoLifecycle = {
  update: (options: VideoOptions) => void;
  play: () => Promise<void>;
  dispose: () => void;
  canPlay: () => boolean;
};

const owners = new WeakMap<HTMLVideoElement, VideoLifecycle>();

export function releaseVideoSource(video: HTMLVideoElement) {
  video.autoplay = false;
  try { video.pause(); } catch { /* Teardown must continue even if the media stack rejects pause. */ }
  const hadSource = video.hasAttribute('src') || Boolean(video.srcObject);
  video.removeAttribute('src');
  if (video.srcObject) video.srcObject = null;
  if (hadSource) {
    try { video.load(); } catch { /* The source is already detached. */ }
  }
}

export function canRequestVideoPlayback(video: HTMLVideoElement) {
  return owners.get(video)?.canPlay() ?? true;
}

export function requestVideoPlayback(video: HTMLVideoElement): Promise<void> {
  const owner = owners.get(video);
  if (owner) return owner.play();
  try { return Promise.resolve(video.play()); } catch (error) { return Promise.reject(error); }
}

/** Own a mobile media element until synchronous ref detachment. */
export function ownVideoElement(video: HTMLVideoElement): VideoLifecycle {
  const doc = video.ownerDocument;
  const win = doc.defaultView;
  let disposed = false;
  let suspended = doc.visibilityState === 'hidden';
  let source: string | undefined;
  let autoplay = false;
  let savedTime = 0;
  let resumePlayback = false;
  let pendingPlay: Promise<void> | null = null;
  let generation = 0;
  let restoreTime = false;

  const allowed = () => !disposed && !suspended && doc.visibilityState !== 'hidden' && Boolean(source) && video.getAttribute('src') === source;
  const play = (): Promise<void> => {
    if (!allowed() || !video.paused) return Promise.resolve();
    if (pendingPlay) return pendingPlay;
    const version = generation;
    let result: Promise<void>;
    try { result = Promise.resolve(video.play()); } catch (error) { return Promise.reject(error); }
    const pending = result.then(() => {
      if (version !== generation && (disposed || suspended)) releaseVideoSource(video);
    }).finally(() => {
      if (pendingPlay === pending) pendingPlay = null;
    });
    pendingPlay = pending;
    return pending;
  };

  const restorePosition = () => {
    if (!restoreTime || !allowed()) return;
    try {
      video.currentTime = Number.isFinite(video.duration) ? Math.min(savedTime, video.duration) : savedTime;
      restoreTime = false;
    } catch { /* Retry when metadata becomes available. */ }
  };

  const attachSource = () => {
    if (disposed || suspended || !source) return;
    if (video.getAttribute('src') !== source) video.setAttribute('src', source);
    // A user-paused video must not autoplay merely because the app became visible again.
    video.autoplay = autoplay && resumePlayback;
    restorePosition();
    if (resumePlayback) void play().catch(() => { /* A later user gesture may retry autoplay. */ });
  };

  const suspend = () => {
    if (disposed || suspended) return;
    savedTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    resumePlayback = !video.paused && !video.ended;
    restoreTime = savedTime > 0;
    suspended = true;
    generation += 1;
    pendingPlay = null;
    releaseVideoSource(video);
  };
  const resume = () => {
    if (disposed || !suspended || doc.visibilityState === 'hidden') return;
    suspended = false;
    attachSource();
  };
  const onVisibility = () => doc.visibilityState === 'hidden' ? suspend() : resume();
  const onPlaying = () => {
    if (disposed || suspended || doc.visibilityState === 'hidden') releaseVideoSource(video);
  };

  const owner: VideoLifecycle = {
    canPlay: allowed,
    play,
    update(options) {
      if (disposed) return;
      const nextAutoplay = Boolean(options.autoPlay);
      const changed = options.src !== source;
      const autoplayEnabled = nextAutoplay && !autoplay;
      autoplay = nextAutoplay;
      if (changed) {
        generation += 1;
        pendingPlay = null;
        releaseVideoSource(video);
        source = options.src;
        savedTime = 0;
        restoreTime = false;
        resumePlayback = autoplay;
        attachSource();
      } else if (autoplayEnabled && !suspended) {
        resumePlayback = true;
        attachSource();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      pendingPlay = null;
      doc.removeEventListener('visibilitychange', onVisibility);
      win?.removeEventListener('pagehide', suspend);
      win?.removeEventListener('pageshow', resume);
      video.removeEventListener('loadedmetadata', restorePosition);
      video.removeEventListener('playing', onPlaying);
      releaseVideoSource(video);
      // Keep the disposed owner in the WeakMap so stale callers cannot restart this element.
    },
  };
  owners.set(video, owner);
  doc.addEventListener('visibilitychange', onVisibility);
  win?.addEventListener('pagehide', suspend);
  win?.addEventListener('pageshow', resume);
  video.addEventListener('loadedmetadata', restorePosition);
  video.addEventListener('playing', onPlaying);
  return owner;
}
