type MediaEventRecord = {
  at: number; player: number; event: string; sourceRevision: number;
  ready: number; network: number; paused: boolean; time: number;
  hasSource: boolean; connected: boolean; error: number | null;
};
const LIMIT = 160;
const records: MediaEventRecord[] = [];
let nextPlayer = 0;
export const VIDEO_DIAGNOSTICS_KEY = 'engui:video-diagnostics:v1';
export function getVideoDiagnostics() { return records.map((record) => ({ ...record })); }

/** Local, bounded and deliberately free of URLs, prompts and asset identifiers. */
export function observeVideoDiagnostics(video: HTMLVideoElement) {
  const player = ++nextPlayer;
  let sourceRevision = 0;
  let lastTime = 0;
  let lastProgress = Date.now();
  let lastSample = 0;
  let reportedStall = false;
  const record = (event: string, anomaly = false) => {
    records.push({ at: Date.now(), player, event, sourceRevision,
      ready: video.readyState, network: video.networkState, paused: video.paused,
      time: Number.isFinite(video.currentTime) ? Math.round(video.currentTime * 100) / 100 : 0,
      hasSource: video.hasAttribute('src'), connected: video.isConnected,
      error: video.error?.code ?? null });
    if (records.length > LIMIT) records.splice(0, records.length - LIMIT);
    if (anomaly) {
      try { video.ownerDocument.defaultView?.sessionStorage.setItem(VIDEO_DIAGNOSTICS_KEY, JSON.stringify(records.slice(-80))); } catch { /* Storage may be unavailable. */ }
    }
  };
  const onEvent = (event: Event) => {
    if (event.type === 'playing' || event.type === 'emptied' || event.type === 'pause') {
      lastProgress = Date.now(); reportedStall = false;
    }
    record(event.type, event.type === 'error' || event.type === 'stalled');
  };
  const onProgress = () => {
    if (video.currentTime !== lastTime) { lastTime = video.currentTime; lastProgress = Date.now(); reportedStall = false; }
    if (Date.now() - lastSample >= 5000) { lastSample = Date.now(); record('progress'); }
  };
  const events = ['loadstart', 'loadedmetadata', 'loadeddata', 'playing', 'pause', 'waiting', 'stalled', 'error', 'ended', 'emptied'];
  events.forEach((event) => video.addEventListener(event, onEvent));
  video.addEventListener('timeupdate', onProgress);
  const win = video.ownerDocument.defaultView;
  if (win) (win as Window & { __enguiVideoDiagnostics?: typeof getVideoDiagnostics }).__enguiVideoDiagnostics = getVideoDiagnostics;
  const timer = win?.setInterval(() => {
    if (video.ownerDocument.visibilityState === 'hidden' || video.paused || video.ended || !video.hasAttribute('src')) {
      lastProgress = Date.now(); return;
    }
    if (video.currentTime !== lastTime) { lastTime = video.currentTime; lastProgress = Date.now(); reportedStall = false; }
    if (!reportedStall && Date.now() - lastProgress >= 8000) { reportedStall = true; record('no-progress', true); }
  }, 4000);
  record('owned');
  return {
    record,
    sourceChanged() { sourceRevision += 1; lastProgress = Date.now(); reportedStall = false; record('source-change'); },
    dispose() {
      events.forEach((event) => video.removeEventListener(event, onEvent));
      video.removeEventListener('timeupdate', onProgress);
      if (timer !== undefined) win?.clearInterval(timer);
      record('disposed');
    },
  };
}
