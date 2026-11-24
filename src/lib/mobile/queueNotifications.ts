export type QueueJobStatus = 'queueing_up' | 'queued' | 'processing' | 'finalizing' | 'completed' | 'failed' | 'submission_unknown';
type Outcome = QueueJobStatus | 'cancelled' | 'removed';
export type QueueJob = { id: string; status: QueueJobStatus; error?: string | null };
export type QueueNotice = { kind: 'started' | 'finished'; message: string; tone: 'info' | 'success' | 'error' };
export type QueueNotificationState = {
  version: 1;
  initialized: boolean;
  cycle: { jobs: Record<string, Outcome>; startNotified: boolean; settledAt: number | null } | null;
  pending: QueueNotice | null;
  unread: boolean;
};

export const QUEUE_SETTLE_MS = 2500;
export const isActiveQueueStatus = (status: string) =>
  status === 'queueing_up' || status === 'queued' || status === 'processing' || status === 'finalizing';

export function emptyQueueNotifications(): QueueNotificationState {
  return { version: 1, initialized: false, cycle: null, pending: null, unread: false };
}

function outcome(job: QueueJob): Outcome {
  return job.status === 'failed' && /cancelled|canceled/i.test(job.error || '') ? 'cancelled' : job.status;
}

function finishNotice(jobs: Record<string, Outcome>): QueueNotice {
  const values = Object.values(jobs);
  const completed = values.filter(status => status === 'completed').length;
  const failed = values.filter(status => status === 'failed').length;
  const cancelled = values.filter(status => status === 'cancelled').length;
  const removed = values.filter(status => status === 'removed').length;
  if (completed === values.length) {
    return { kind: 'finished', tone: 'success', message: completed === 1 ? '1 job completed' : `All ${completed} jobs completed` };
  }
  const counts = [
    completed && `${completed} completed`, failed && `${failed} failed`,
    cancelled && `${cancelled} cancelled`, removed && `${removed} removed`,
  ].filter(Boolean).join(', ');
  return { kind: 'finished', tone: failed ? 'error' : 'info', message: `Queue ${completed || failed ? 'finished' : 'stopped'} · ${counts}` };
}

/** Reconcile only a successfully hydrated workspace list. Network/loading failures are not snapshots. */
export function advanceQueueNotifications(
  previous: QueueNotificationState, jobs: readonly QueueJob[], now: number,
): QueueNotificationState {
  const active = jobs.filter(job => isActiveQueueStatus(job.status));
  const next: QueueNotificationState = { ...previous, initialized: true };
  let cycle = previous.cycle;
  if (!cycle) {
    if (!active.length) return next;
    cycle = {
      jobs: Object.fromEntries(active.map(job => [job.id, outcome(job)])),
      // Adopt an already running queue silently on the very first snapshot.
      startNotified: !previous.initialized && active.some(job => job.status === 'processing' || job.status === 'finalizing'),
      settledAt: null,
    };
  }
  cycle = { ...cycle, jobs: { ...cycle.jobs } };
  const current = new Map(jobs.map(job => [job.id, job]));
  for (const [id, last] of Object.entries(cycle.jobs)) {
    const job = current.get(id);
    if (job) cycle.jobs[id] = outcome(job);
    else if (isActiveQueueStatus(last)) cycle.jobs[id] = 'removed';
    // Clearing history must not erase known terminal results.
  }
  for (const job of active) cycle.jobs[job.id] = outcome(job);
  if (active.length) {
    cycle.settledAt = null;
    if (!cycle.startNotified && active.some(job => job.status === 'processing')) {
      cycle.startNotified = true;
      const count = Object.keys(cycle.jobs).length;
      next.pending = { kind: 'started', tone: 'info', message: `Queue started · ${count} ${count === 1 ? 'job' : 'jobs'}` };
    }
  } else {
    cycle.settledAt ??= now;
    if (now - cycle.settledAt >= QUEUE_SETTLE_MS) {
      next.pending = finishNotice(cycle.jobs);
      next.unread = true;
      next.cycle = null;
      return next;
    }
  }
  next.cycle = cycle;
  return next;
}

const keyFor = (workspaceId: string) => `engui.mobile.queue-notifications.v1.${encodeURIComponent(workspaceId)}`;
const outcomes = new Set(['queueing_up', 'queued', 'processing', 'finalizing', 'completed', 'failed', 'cancelled', 'removed']);
export function readQueueNotifications(workspaceId: string): QueueNotificationState {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(keyFor(workspaceId)) || 'null');
    if (!value || value.version !== 1 || typeof value.initialized !== 'boolean' || typeof value.unread !== 'boolean') return emptyQueueNotifications();
    if (value.cycle !== null) {
      const c = value.cycle;
      if (!c || typeof c.startNotified !== 'boolean' || !c.jobs || Array.isArray(c.jobs) || typeof c.jobs !== 'object'
        || !Object.keys(c.jobs).length || !Object.values(c.jobs).every(status => typeof status === 'string' && outcomes.has(status))
        || !(c.settledAt === null || (typeof c.settledAt === 'number' && Number.isFinite(c.settledAt)))) return emptyQueueNotifications();
    }
    if (value.pending !== null) {
      const p = value.pending;
      if (!p || !['started', 'finished'].includes(p.kind) || !['info', 'success', 'error'].includes(p.tone) || typeof p.message !== 'string') return emptyQueueNotifications();
    }
    return value as QueueNotificationState;
  } catch { return emptyQueueNotifications(); }
}
export function writeQueueNotifications(workspaceId: string, state: QueueNotificationState): void {
  try { window.sessionStorage.setItem(keyFor(workspaceId), JSON.stringify(state)); } catch { /* In-memory dedupe still works if storage is unavailable. */ }
}
