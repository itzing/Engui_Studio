/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ManagedVideo } from '@/components/media/ManagedVideo';

let visibility = 'visible';
let serial = 0;
const revoke = vi.fn();
const play = vi.fn(function (this: HTMLMediaElement) { Object.defineProperty(this, 'paused', { configurable: true, value: false }); return Promise.resolve(); });
const media = () => new Response(new Uint8Array(4), { headers: { 'content-type': 'video/mp4', 'content-length': '4' } });
const props = { src: '/a.mp4', autoPlay: true, prefetchUrls: ['/b.mp4', '/c.mp4'], prefetchScope: 'workspace-a' };
const ready = (video: HTMLVideoElement) => {
  Object.defineProperty(video, 'readyState', { configurable: true, value: 4 });
  Object.defineProperty(video, 'duration', { configurable: true, value: 6 });
  Object.defineProperty(video, 'buffered', { configurable: true, value: { length: 1, start: () => 0, end: () => 6 } });
  fireEvent.playing(video);
};
const drain = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(350); }); };
beforeEach(() => {
  vi.useFakeTimers(); visibility = 'visible'; serial = 0;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.stubGlobal('fetch', vi.fn(async () => media()));
  vi.stubGlobal('URL', class extends URL { static createObjectURL() { return `blob:test-${++serial}`; } static revokeObjectURL = revoke; });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: function () { Object.defineProperty(this, 'paused', { configurable: true, value: true }); } });
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: function () { Object.defineProperty(this, 'readyState', { configurable: true, value: 0 }); } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); delete (document as unknown as { visibilityState?: string }).visibilityState; });

it('waits for buffered playback, reuses cached files on revisits, and never switches a playing miss mid-download', async () => {
  const view = render(React.createElement(ManagedVideo, props)); const video = view.container.querySelector('video')!;
  await drain(); expect(fetch).not.toHaveBeenCalled(); expect(video.getAttribute('src')).toBe('/a.mp4');
  ready(video); await drain(); expect(fetch).toHaveBeenCalledTimes(3); expect(video.getAttribute('src')).toBe('/a.mp4');
  view.rerender(React.createElement(ManagedVideo, { ...props, src: '/b.mp4', prefetchUrls: ['/c.mp4', '/a.mp4'] }));
  expect(view.container.querySelector('video')).toBe(video); expect(video.getAttribute('src')).toMatch(/^blob:/);
  const oldBlob = video.getAttribute('src');
  view.rerender(React.createElement(ManagedVideo, props));
  expect(video.getAttribute('src')).toMatch(/^blob:/); expect(video.dataset.mediaSource).toBe('/a.mp4');
  expect(revoke).toHaveBeenCalledWith(oldBlob);
  await drain(); expect(fetch).toHaveBeenCalledTimes(3);
  view.unmount(); expect(video.hasAttribute('src')).toBe(false); expect(revoke).toHaveBeenCalledTimes(2);
});

it('falls back from a failed Blob once on the same player and reports only a later native failure', async () => {
  const onError = vi.fn(); const view = render(React.createElement(ManagedVideo, { ...props, onError }));
  const video = view.container.querySelector('video')!; ready(video); await drain();
  view.rerender(React.createElement(ManagedVideo, { ...props, src: '/b.mp4', onError }));
  const blob = video.getAttribute('src'); expect(blob).toMatch(/^blob:/);
  fireEvent.error(video); expect(video.getAttribute('src')).toBe('/b.mp4'); expect(onError).not.toHaveBeenCalled(); expect(revoke).toHaveBeenCalledWith(blob);
  fireEvent.error(video); expect(onError).toHaveBeenCalledTimes(1); expect(view.container.querySelectorAll('video')).toHaveLength(1);
});

it('keeps a paused cached source valid across background and clears it on viewer/scope disposal', async () => {
  const view = render(React.createElement(ManagedVideo, props)); const video = view.container.querySelector('video')!;
  ready(video); await drain();
  view.rerender(React.createElement(ManagedVideo, { ...props, src: '/b.mp4' })); const blob = video.getAttribute('src'); video.pause();
  act(() => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
  expect(video.hasAttribute('src')).toBe(false); expect(revoke).not.toHaveBeenCalled();
  const count = vi.mocked(fetch).mock.calls.length; await drain(); expect(fetch).toHaveBeenCalledTimes(count);
  act(() => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  expect(video.getAttribute('src')).toBe(blob); expect(video.paused).toBe(true);
  view.rerender(React.createElement(ManagedVideo, { ...props, src: '/b.mp4', prefetchScope: 'workspace-b' }));
  expect(video.getAttribute('src')).toBe('/b.mp4'); expect(revoke).toHaveBeenCalledWith(blob);
});

it('does not resume a user-paused cached video during native fallback or control rerenders', async () => {
  const view = render(React.createElement(ManagedVideo, props)); const video = view.container.querySelector('video')!;
  ready(video); await drain();
  view.rerender(React.createElement(ManagedVideo, { ...props, src: '/b.mp4' }));
  ready(video); video.pause(); fireEvent.pause(video); play.mockClear();
  fireEvent.error(video); expect(video.getAttribute('src')).toBe('/b.mp4'); expect(play).not.toHaveBeenCalled();
  view.rerender(React.createElement(ManagedVideo, { ...props, src: '/b.mp4', controls: true }));
  expect(play).not.toHaveBeenCalled(); expect(video.paused).toBe(true);
});
