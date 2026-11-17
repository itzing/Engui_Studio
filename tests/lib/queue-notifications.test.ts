/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceQueueNotifications as advance, emptyQueueNotifications as empty, QUEUE_SETTLE_MS,
  readQueueNotifications as read, writeQueueNotifications as write, type QueueJob, type QueueNotificationState,
} from '@/lib/mobile/queueNotifications';

const job = (id: string, status: QueueJob['status'] = 'queued', error?: string): QueueJob => ({ id, status, error });
const consume = (state: QueueNotificationState): QueueNotificationState => ({ ...state, pending: null });
const finish = (state: QueueNotificationState, jobs: QueueJob[]) => advance(advance(state, jobs, 100), jobs, 100 + QUEUE_SETTLE_MS);

beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

describe('mobile queue lifecycle', () => {
  it('keeps initial completed/failed history silent and out of later counts', () => {
    const history = [job('old', 'completed'), job('error', 'failed')];
    let state = advance(empty(), history, 0);
    expect(state.pending).toBeNull();
    state = advance(state, [...history, job('new')], 1);
    expect(finish(state, [...history, job('new', 'completed')]).pending?.message).toBe('1 job completed');
  });
  it('notifies only the first processing transition despite later workers and requeues', () => {
    let state = advance(empty(), [job('a'), job('b')], 0);
    expect(state.pending).toBeNull();
    state = advance(state, [job('a', 'processing'), job('b')], 1);
    expect(state.pending?.message).toBe('Queue started · 2 jobs');
    state = consume(state);
    state = advance(state, [job('a'), job('b')], 2);
    state = advance(state, [job('a'), job('b', 'processing')], 3);
    expect(state.pending).toBeNull();
  });
  it('adopts an already running initial queue without announcing a retrospective start', () => {
    const state = advance(empty(), [job('a', 'processing'), job('b')], 0);
    expect(state.pending).toBeNull();
    expect(finish(state, [job('a', 'completed'), job('b', 'completed')]).pending?.message).toBe('All 2 jobs completed');
  });
  it('holds completion during finalizing and waits for all jobs', () => {
    let state = advance(empty(), [job('a'), job('b')], 0);
    state = advance(state, [job('a', 'completed'), job('b', 'finalizing')], 100);
    expect(advance(state, [job('a', 'completed'), job('b', 'finalizing')], 10000).pending).toBeNull();
    expect(finish(state, [job('a', 'completed'), job('b', 'completed')]).pending?.tone).toBe('success');
  });
  it('extends the same cycle when a new job arrives during the settle window', () => {
    let state = advance(empty(), [job('a')], 0);
    state = consume(advance(state, [job('a', 'processing')], 1));
    state = advance(state, [job('a', 'completed')], 2);
    state = advance(state, [job('a', 'completed'), job('b')], 1000);
    expect(state.cycle?.settledAt).toBeNull();
    state = advance(state, [job('a', 'completed'), job('b', 'processing')], 10000);
    expect(state.pending).toBeNull();
    expect(finish(state, [job('a', 'completed'), job('b', 'completed')]).pending?.message).toBe('All 2 jobs completed');
  });
  it('debounces completion, emits it once and permits a subsequent new cycle', () => {
    let state = advance(empty(), [job('a')], 0);
    state = advance(state, [job('a', 'completed')], 1);
    expect(advance(state, [job('a', 'completed')], QUEUE_SETTLE_MS).pending).toBeNull();
    state = consume(advance(state, [job('a', 'completed')], QUEUE_SETTLE_MS + 1));
    expect(advance(state, [job('a', 'completed')], 10000).pending).toBeNull();
    state = advance(state, [job('a', 'completed'), job('b')], 10001);
    expect(advance(state, [job('a', 'completed'), job('b', 'processing')], 10002).pending?.message).toBe('Queue started · 1 job');
  });
  it('does not invent a start when a fast job completes between polls', () => {
    const state = advance(empty(), [job('a')], 0);
    expect(finish(state, [job('a', 'completed')]).pending?.kind).toBe('finished');
  });
  it('replaces an unconsumed start with the final result', () => {
    let state = advance(empty(), [job('a')], 0);
    state = advance(state, [job('a', 'processing')], 1);
    expect(finish(state, [job('a', 'completed')]).pending?.kind).toBe('finished');
  });
  it('reports successes, errors, cancellation and removed active jobs truthfully', () => {
    const state = advance(empty(), ['a', 'b', 'c', 'd'].map(id => job(id)), 0);
    const result = finish(state, [job('a', 'completed'), job('b', 'failed', 'worker error'), job('c', 'failed', 'cancelled')]);
    expect(result.pending).toEqual({ kind: 'finished', tone: 'error', message: 'Queue finished · 1 completed, 1 failed, 1 cancelled, 1 removed' });
  });
  it('does not call an all-cancelled/removed queue successful', () => {
    const state = advance(empty(), [job('a'), job('b')], 0);
    expect(finish(state, [job('a', 'failed', 'canceled')]).pending?.message).toBe('Queue stopped · 1 cancelled, 1 removed');
  });
  it('retains completed counts when the user clears history mid-cycle', () => {
    let state = advance(empty(), [job('a'), job('b')], 0);
    state = advance(state, [job('a', 'completed'), job('b')], 1);
    expect(finish(state, [job('b', 'completed')]).pending?.message).toBe('All 2 jobs completed');
  });
  it('handles all 50 active jobs with a single start and a single outcome', () => {
    let state = advance(empty(), Array.from({ length: 50 }, (_, i) => job(String(i))), 0);
    state = advance(state, Array.from({ length: 50 }, (_, i) => job(String(i), 'processing')), 1);
    expect(state.pending?.message).toBe('Queue started · 50 jobs');
    expect(finish(consume(state), Array.from({ length: 50 }, (_, i) => job(String(i), 'completed'))).pending?.message).toBe('All 50 jobs completed');
  });
  it('resumes a known queued cycle after reload without including old history', () => {
    write('one', advance(empty(), [job('a')], 0));
    const restored = read('one');
    expect(advance(restored, [job('a', 'processing')], 1).pending?.kind).toBe('started');
    expect(read('two').initialized).toBe(false);
    expect(finish(restored, [job('a', 'completed')]).pending?.kind).toBe('finished');
  });
  it('persists consumed starts and unread completion independently per workspace', () => {
    let state = advance(empty(), [job('a')], 0);
    state = consume(advance(state, [job('a', 'processing')], 1));
    write('one', state);
    expect(advance(read('one'), [job('a', 'processing')], 2).pending).toBeNull();
    write('one', consume(finish(state, [job('a', 'completed')])));
    expect(read('one').unread).toBe(true);
    expect(read('two').unread).toBe(false);
  });
  it('tolerates corrupt or blocked storage without breaking the app', () => {
    sessionStorage.setItem('engui.mobile.queue-notifications.v1.one', '{"version":1,"initialized":true,"unread":false,"cycle":{}}');
    expect(read('one')).toEqual(empty());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => write('one', empty())).not.toThrow();
  });
});
