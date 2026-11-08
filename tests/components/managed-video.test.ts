/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagedVideo } from '@/components/media/ManagedVideo';
import { requestVideoPlayback } from '@/lib/media/videoLifecycle';

let visibility = 'visible';
const play = vi.fn(function (this: HTMLMediaElement) {
  Object.defineProperty(this, 'paused', { configurable: true, value: false });
  return Promise.resolve();
});
const pause = vi.fn(function (this: HTMLMediaElement) {
  Object.defineProperty(this, 'paused', { configurable: true, value: true });
});
const load = vi.fn(function (this: HTMLMediaElement) { this.currentTime = 0; });
const hide = () => act(() => {
  visibility = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pagehide'));
});
const show = () => act(() => {
  visibility = 'visible';
  window.dispatchEvent(new Event('pageshow'));
  document.dispatchEvent(new Event('visibilitychange'));
});

beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause });
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: load });
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); delete (document as unknown as { visibilityState?: string }).visibilityState; });

describe('owned mobile video lifecycle', () => {
  it('releases the source synchronously before reporting ref detachment', () => {
    let video: HTMLVideoElement;
    const onElement = vi.fn((element: HTMLVideoElement | null) => {
      if (element) video = element;
      else expect(video.hasAttribute('src')).toBe(false);
    });
    const view = render(React.createElement(ManagedVideo, { src: '/first.mp4', onElement }));
    video = view.container.querySelector('video')!;
    pause.mockClear(); load.mockClear();
    view.unmount();
    expect(video.hasAttribute('src')).toBe(false);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(onElement).toHaveBeenLastCalledWith(null);
  });

  it('does not reload or restart for parent callback and controls rerenders', () => {
    const view = render(React.createElement(ManagedVideo, { src: '/first.mp4', autoPlay: true, onElement: vi.fn() }));
    const video = view.container.querySelector('video')!;
    video.pause();
    play.mockClear(); pause.mockClear(); load.mockClear();
    view.rerender(React.createElement(ManagedVideo, { src: '/first.mp4', autoPlay: true, controls: true, onElement: vi.fn() }));
    expect(view.container.querySelector('video')).toBe(video);
    expect(video.getAttribute('src')).toBe('/first.mp4');
    expect(video.paused).toBe(true);
    expect(play).not.toHaveBeenCalled(); expect(pause).not.toHaveBeenCalled(); expect(load).not.toHaveBeenCalled();
  });

  it('releases on source replacement and makes only the new source current', () => {
    const view = render(React.createElement(ManagedVideo, { src: '/first.mp4' }));
    const video = view.container.querySelector('video')!;
    load.mockClear();
    view.rerender(React.createElement(ManagedVideo, { src: '/second.mp4' }));
    expect(load).toHaveBeenCalledTimes(1);
    expect(video.getAttribute('src')).toBe('/second.mp4');
  });

  it('suspends once and restores position plus playing intent on return', async () => {
    const view = render(React.createElement(ManagedVideo, { src: '/first.mp4', autoPlay: true }));
    const video = view.container.querySelector('video')!;
    video.currentTime = 4;
    await act(async () => { await Promise.resolve(); });
    load.mockClear();
    hide();
    expect(video.hasAttribute('src')).toBe(false); expect(video.autoplay).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    await requestVideoPlayback(video); expect(video.hasAttribute('src')).toBe(false);
    show();
    act(() => video.dispatchEvent(new Event('loadedmetadata')));
    expect(video.getAttribute('src')).toBe('/first.mp4');
    expect(video.currentTime).toBe(4); expect(video.paused).toBe(false);
  });

  it('does not resume a user-paused autoplay video after backgrounding', () => {
    const view = render(React.createElement(ManagedVideo, { src: '/first.mp4', autoPlay: true }));
    const video = view.container.querySelector('video')!;
    video.pause(); video.currentTime = 2;
    play.mockClear();
    hide(); show();
    expect(video.getAttribute('src')).toBe('/first.mp4');
    expect(video.currentTime).toBe(2); expect(video.paused).toBe(true); expect(video.autoplay).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });

  it('does not load a hidden mount, restores the latest source and never resurrects unmounted media', () => {
    visibility = 'hidden';
    const view = render(React.createElement(ManagedVideo, { src: '/first.mp4', autoPlay: true }));
    const video = view.container.querySelector('video')!;
    expect(video.hasAttribute('src')).toBe(false); expect(play).not.toHaveBeenCalled();
    view.rerender(React.createElement(ManagedVideo, { src: '/second.mp4', autoPlay: true }));
    expect(video.hasAttribute('src')).toBe(false);
    show(); expect(video.getAttribute('src')).toBe('/second.mp4');
    hide(); view.unmount(); show();
    expect(video.hasAttribute('src')).toBe(false);
  });

  it('blocks stale playback calls and a pending play completion after teardown', async () => {
    let resolvePlay!: () => void;
    play.mockImplementationOnce(function (this: HTMLMediaElement) {
      return new Promise<void>((resolve) => { resolvePlay = resolve; });
    });
    const view = render(React.createElement(ManagedVideo, { src: '/first.mp4', autoPlay: true }));
    const video = view.container.querySelector('video')!;
    view.unmount();
    await act(async () => { resolvePlay(); await Promise.resolve(); });
    const calls = play.mock.calls.length;
    await requestVideoPlayback(video);
    expect(play.mock.calls.length).toBe(calls); expect(video.hasAttribute('src')).toBe(false); expect(video.paused).toBe(true);
  });

  it('handles pagehide even while visibilityState still reports visible', () => {
    const view = render(React.createElement(ManagedVideo, { src: '/first.mp4', autoPlay: true }));
    const video = view.container.querySelector('video')!;
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(video.hasAttribute('src')).toBe(false);
    act(() => window.dispatchEvent(new Event('pageshow')));
    expect(video.getAttribute('src')).toBe('/first.mp4');
  });
  it('allows a user retry after an autoplay rejection without an automatic retry loop', async () => {
    play.mockRejectedValueOnce(new DOMException('Gesture required', 'NotAllowedError'));
    const view = render(React.createElement(ManagedVideo, { src: '/first.mp4', autoPlay: true }));
    const video = view.container.querySelector('video')!;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(play).toHaveBeenCalledTimes(1);
    await requestVideoPlayback(video);
    expect(play).toHaveBeenCalledTimes(2);
  });

});
