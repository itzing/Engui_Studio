/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecoverableVideo } from '@/components/media/RecoverableVideo';
import { getVideoDiagnosticReport } from '@/lib/media/videoDiagnostics';

let visibility = 'visible';
const field = (video: HTMLMediaElement, key: string, value: unknown) => Object.defineProperty(video, key, { configurable: true, value });
const play = vi.fn(function (this: HTMLMediaElement) {
  field(this, 'paused', false); this.dispatchEvent(new Event('play')); return Promise.resolve();
});
const pause = vi.fn(function (this: HTMLMediaElement) {
  field(this, 'paused', true); this.dispatchEvent(new Event('pause'));
});
const load = vi.fn(function (this: HTMLMediaElement) {
  this.currentTime = 0; field(this, 'readyState', 0); field(this, 'error', null); this.dispatchEvent(new Event('emptied'));
});
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const renderPlayer = (src = '/private-video.mp4') => render(React.createElement(RecoverableVideo, { src, autoPlay: true, muted: true, playsInline: true }));
const fail = async (video: HTMLVideoElement) => {
  act(() => { field(video, 'error', { code: 4 }); field(video, 'paused', true); fireEvent.error(video); }); await flush();
};
beforeEach(() => {
  vi.useFakeTimers(); visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: load });
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup(); vi.useRealTimers();
  delete (document as unknown as { visibilityState?: string }).visibilityState;
  delete (navigator as unknown as { clipboard?: unknown }).clipboard;
});

describe('Gallery/Jobs owned player recovery', () => {
  it('offers manual recovery after an error; Retry preserves the element and muted inline playback', async () => {
    const view = renderPlayer(); const video = view.container.querySelector('video')!; await flush();
    await fail(video); expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    advance(60_000); expect(play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await flush();
    expect(view.container.querySelector('video')).toBe(video); expect(video.muted).toBe(true); expect(video.playsInline).toBe(true);
    expect(play).toHaveBeenCalledTimes(2); expect(video.getAttribute('src')).toBe('/private-video.mp4');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
  it('offers Retry after 10 seconds without progress, but never automatically restarts', async () => {
    renderPlayer(); await flush(); advance(9000); expect(screen.queryByText('Video is not responding.')).toBeNull();
    advance(1000); expect(screen.getByText('Video is not responding.')).toBeTruthy();
    advance(60_000); expect(play).toHaveBeenCalledTimes(1);
  });
  it('does not confuse slow startup followed by progress with a failure; buffering later can time out', async () => {
    const view = renderPlayer(); const video = view.container.querySelector('video')!; await flush();
    for (let i = 1; i <= 4; i++) { advance(4000); act(() => { video.currentTime = i; fireEvent.timeUpdate(video); }); }
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    advance(10_000); expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    act(() => { video.currentTime = 5; fireEvent.timeUpdate(video); });
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
  it('does not mark user-paused playback as stalled or resume it on visibility changes', async () => {
    const view = renderPlayer(); const video = view.container.querySelector('video')!; await flush();
    act(() => { field(video, 'readyState', 4); video.pause(); }); advance(30_000);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    act(() => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); }); advance(30_000);
    act(() => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }); advance(30_000);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull(); expect(play).toHaveBeenCalledTimes(1);
  });
  it('does not count hidden time, gives resumed playback a fresh timeout and releases on close', async () => {
    const view = renderPlayer(); const video = view.container.querySelector('video')!; await flush(); advance(7000);
    act(() => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); }); advance(60_000);
    expect(video.hasAttribute('src')).toBe(false); expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    act(() => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }); await flush(); advance(9000);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull(); advance(1000); expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    view.unmount(); expect(video.hasAttribute('src')).toBe(false); const calls = play.mock.calls.length;
    advance(60_000); expect(play).toHaveBeenCalledTimes(calls);
  });
  it('handles pagehide/pageshow even before visibilityState changes', async () => {
    const view = renderPlayer(); await flush(); advance(7000);
    act(() => window.dispatchEvent(new Event('pagehide'))); advance(60_000);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    act(() => window.dispatchEvent(new Event('pageshow'))); await flush(); advance(9000);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(view.container.querySelector('video')!.hasAttribute('src')).toBe(true);
  });
  it('resets error/timeout state on a source change and disables it for image slides', async () => {
    const view = renderPlayer(); await flush(); advance(10_000);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy(); const video = view.container.querySelector('video');
    view.rerender(React.createElement(RecoverableVideo, { src: '/next.mp4', autoPlay: true, muted: true })); await flush();
    expect(view.container.querySelector('video')).toBe(video); expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    view.rerender(React.createElement(RecoverableVideo, { src: undefined, autoPlay: false })); advance(60_000);
    expect(video!.hasAttribute('src')).toBe(false); expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
  it('handles rejected autoplay immediately, records only its safe name and retries after a gesture', async () => {
    play.mockRejectedValueOnce(new DOMException('Secret URL https://secret.invalid/token', 'NotAllowedError'));
    renderPlayer(); await flush(); expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    const report = JSON.stringify(getVideoDiagnosticReport()); expect(report).toContain('NotAllowedError'); expect(report).not.toContain('secret.invalid'); expect(report).not.toContain('private-video');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await flush(); expect(play).toHaveBeenCalledTimes(2);
  });
  it('does not attribute an old play rejection to a newly selected video', async () => {
    let reject!: (e: Error) => void;
    play.mockImplementationOnce(() => new Promise<void>((_, no) => { reject = no; }));
    const view = renderPlayer(); view.rerender(React.createElement(RecoverableVideo, { src: '/next.mp4', autoPlay: true }));
    await act(async () => { reject(new DOMException('old source', 'AbortError')); }); await flush();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
  it('recovers a never-settling play request without remount or waiting for the old promise', async () => {
    let resolve!: () => void;
    play.mockImplementationOnce(function (this: HTMLMediaElement) { field(this, 'paused', false); return new Promise<void>(yes => { resolve = yes; }); });
    const view = renderPlayer(); const video = view.container.querySelector('video')!; advance(10_000);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await flush();
    expect(play).toHaveBeenCalledTimes(2); expect(video.paused).toBe(false); expect(view.container.querySelector('video')).toBe(video);
    await act(async () => resolve()); expect(video.paused).toBe(false);
  });
  it('copies bounded local diagnostics, with a text fallback when clipboard permission is denied', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const view = renderPlayer(); await flush(); await fail(view.container.querySelector('video')!);
    fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostics' })); await flush();
    expect(screen.getByRole('textbox', { name: 'Video diagnostics — select and copy' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostics' })); await flush();
    expect(screen.getByRole('button', { name: 'Diagnostics copied' })).toBeTruthy();
    const data = JSON.parse(writeText.mock.calls[1][0]); expect(data.events.length).toBeLessThanOrEqual(160);
    expect(data.events.at(-1).muted).toBe(true); expect(data.schema).toBe('engui-video-diagnostics-v2');
    expect(JSON.stringify(data)).not.toContain('/private-video.mp4');
  });
});
