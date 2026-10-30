/** @vitest-environment jsdom */
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MobileJobDetailOutput } from '@/hooks/jobs/useMobileJobDetails';
const { request, updated } = vi.hoisted(() => ({ request: vi.fn(), updated: vi.fn() }));
vi.mock('@/lib/workspaces/useWorkspaceFetch', () => ({ useWorkspaceFetch: () => request }));
import MobileJobGalleryActions, { useMobileJobGalleryActions } from '@/components/mobile/jobs/MobileJobGalleryActions';

function output(buckets: MobileJobDetailOutput['savedBuckets'] = []): MobileJobDetailOutput {
  return { outputId: 'output-1', type: 'image', url: '/fixture.svg', previewUrl: null, thumbnailUrl: null,
    savedBuckets: buckets, galleryAssetIdsByBucket: Object.fromEntries(buckets.map(bucket => [bucket, [bucket + '-asset']])),
    alreadyInGallery: buckets.length > 0, galleryAssetId: buckets.length ? buckets[0] + '-asset' : null };
}
function Harness({ initial = output(), jobId = 'job-1', visible = true, disabled = false }: {
  initial?: MobileJobDetailOutput; jobId?: string; visible?: boolean; disabled?: boolean;
}) {
  const [outputs, setOutputs] = useState<Record<string, MobileJobDetailOutput>>({ 'job-1': initial, 'job-2': output() });
  const actions = useMobileJobGalleryActions((id, outputId, update) => {
    updated(id, outputId);
    setOutputs(current => ({ ...current, [id]: update(current[id]) }));
  });
  return React.createElement(React.Fragment, null,
    visible && React.createElement(MobileJobGalleryActions, { jobId, output: outputs[jobId], actions, disabled }),
    React.createElement('pre', { 'data-testid': 'outputs' }, JSON.stringify(outputs)));
}
const state = () => JSON.parse(screen.getByTestId('outputs').textContent!);
const ok = (id = 'new-asset') => ({ ok: true, json: async () => ({ success: true, asset: { id } }) });
const fail = () => ({ ok: false, json: async () => ({ success: false }) });
const labels = {
  common: ['Add job output to gallery', 'Remove job output from gallery'],
  draft: ['Save output as draft', 'Remove output from drafts'],
};
beforeEach(() => { vi.clearAllMocks(); request.mockReset(); request.mockResolvedValue(ok()); });
afterEach(cleanup);

describe('Mobile fullscreen job bucket toggles', () => {
  it.each(['common', 'draft'] as const)('adds, retains and removes the %s icon, then allows adding again', async bucket => {
    render(React.createElement(Harness));
    fireEvent.click(screen.getByRole('button', { name: labels[bucket][0] }));
    const saved = await screen.findByRole('button', { name: labels[bucket][1] });
    expect(saved.getAttribute('aria-pressed')).toBe('true');
    expect(request.mock.calls[0][0]).toBe('/api/gallery/assets/from-job-output');
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ jobId: 'job-1', outputId: 'output-1', bucket });
    fireEvent.click(saved);
    await screen.findByRole('button', { name: labels[bucket][0] });
    expect(request.mock.calls[1][0]).toBe('/api/gallery/assets/new-asset/trash');
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ trashed: true });
    expect(state()['job-1'].savedBuckets).toEqual([]);
    expect(state()['job-1'].alreadyInGallery).toBe(false);
    expect(state()['job-1'].galleryAssetId).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: labels[bucket][0] }));
    await screen.findByRole('button', { name: labels[bucket][1] });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each(['common', 'draft'] as const)('removes only %s copies and preserves the other bucket and primary ID', async bucket => {
    const other = bucket === 'common' ? 'draft' : 'common';
    render(React.createElement(Harness, { initial: output([bucket, other]) }));
    fireEvent.click(screen.getByRole('button', { name: labels[bucket][1] }));
    await screen.findByRole('button', { name: labels[bucket][0] });
    expect(state()['job-1'].savedBuckets).toEqual([other]);
    expect(state()['job-1'].alreadyInGallery).toBe(true);
    expect(state()['job-1'].galleryAssetId).toBe(other + '-asset');
    expect(request.mock.calls.map(call => call[0])).toEqual(['/api/gallery/assets/' + bucket + '-asset/trash']);
    expect(screen.getByRole('button', { name: labels[other][1] })).toBeTruthy();
  });

  it('removes duplicate IDs only once and handles all saved copies', async () => {
    const initial = output(['common']); initial.galleryAssetIdsByBucket.common = ['a', 'a', 'b'];
    render(React.createElement(Harness, { initial }));
    fireEvent.click(screen.getByRole('button', { name: labels.common[1] }));
    await screen.findByRole('button', { name: labels.common[0] });
    expect(request.mock.calls.map(call => call[0])).toEqual(['/api/gallery/assets/a/trash', '/api/gallery/assets/b/trash']);
  });

  it('keeps failed copies saved after partial removal and retries only remaining IDs', async () => {
    const initial = output(['common', 'draft']); initial.galleryAssetIdsByBucket.common = ['a', 'b']; initial.galleryAssetId = 'a';
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(fail());
    render(React.createElement(Harness, { initial }));
    fireEvent.click(screen.getByRole('button', { name: labels.common[1] }));
    await screen.findByText('Could not remove item. Please try again.');
    expect(state()['job-1'].galleryAssetIdsByBucket.common).toEqual(['b']);
    expect(state()['job-1'].savedBuckets).toEqual(['common', 'draft']);
    fireEvent.click(screen.getByRole('button', { name: labels.common[1] }));
    await screen.findByRole('button', { name: labels.common[0] });
    expect(request.mock.calls.map(call => call[0])).toEqual(['/api/gallery/assets/a/trash', '/api/gallery/assets/b/trash', '/api/gallery/assets/b/trash']);
  });

  it.each(['save', 'remove'] as const)('preserves state on a failed %s request', async action => {
    request.mockResolvedValue(fail());
    const initial = output(action === 'save' ? [] : ['common']);
    render(React.createElement(Harness, { initial }));
    fireEvent.click(screen.getByRole('button', { name: labels.common[action === 'save' ? 0 : 1] }));
    await screen.findByRole('status');
    expect(state()['job-1']).toEqual(initial);
    expect(updated).not.toHaveBeenCalled();
  });

  it('handles network errors and reenables the controls', async () => {
    request.mockRejectedValue(new Error('Network unavailable'));
    render(React.createElement(Harness));
    const button = screen.getByRole('button', { name: labels.common[0] });
    fireEvent.click(button);
    await screen.findByText('Network unavailable');
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(updated).not.toHaveBeenCalled();
  });

  it('does not use an unscoped primary ID when bucket IDs are missing', async () => {
    const initial = output(['common', 'draft']); initial.galleryAssetIdsByBucket.common = [];
    render(React.createElement(Harness, { initial }));
    fireEvent.click(screen.getByRole('button', { name: labels.common[1] }));
    await screen.findByRole('status');
    expect(request).not.toHaveBeenCalled();
    expect(state()['job-1']).toEqual(initial);
  });

  it('blocks duplicate taps and both bucket controls while pending', async () => {
    let resolve!: (value: any) => void;
    request.mockReturnValue(new Promise(r => { resolve = r; }));
    render(React.createElement(Harness));
    const add = screen.getByRole('button', { name: labels.common[0] });
    fireEvent.click(add); fireEvent.click(add); fireEvent.click(screen.getByRole('button', { name: labels.draft[0] }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(add.getAttribute('aria-busy')).toBe('true');
    await act(async () => resolve(ok()));
    await screen.findByRole('button', { name: labels.common[1] });
  });

  it('keeps pending work attached to the original job when controls hide and slides change', async () => {
    let resolve!: (value: any) => void;
    request.mockReturnValue(new Promise(r => { resolve = r; }));
    const view = render(React.createElement(Harness));
    fireEvent.click(screen.getByRole('button', { name: labels.common[0] }));
    view.rerender(React.createElement(Harness, { visible: false, jobId: 'job-2' }));
    await act(async () => resolve(ok()));
    expect(state()['job-1'].savedBuckets).toEqual(['common']);
    expect(state()['job-2'].savedBuckets).toEqual([]);
    view.rerender(React.createElement(Harness, { jobId: 'job-1' }));
    expect(screen.getByRole('button', { name: labels.common[1] })).toBeTruthy();
  });

  it('aborts and ignores late responses after the owning screen unmounts', async () => {
    let resolve!: (value: any) => void;
    request.mockReturnValue(new Promise(r => { resolve = r; }));
    const view = render(React.createElement(Harness));
    fireEvent.click(screen.getByRole('button', { name: labels.common[0] }));
    const signal = request.mock.calls[0][1].signal;
    view.unmount(); expect(signal.aborted).toBe(true);
    await act(async () => resolve(ok()));
    expect(updated).not.toHaveBeenCalled();
  });

  it('keeps saved drafts removable on upscale outputs without adding a new draft action for upscale-only outputs', () => {
    const view = render(React.createElement(Harness, { initial: output(['upscale', 'draft']) }));
    expect(screen.getByRole('button', { name: labels.draft[1] })).toBeTruthy();
    view.unmount();
    render(React.createElement(Harness, { initial: output(['upscale']) }));
    expect(screen.queryByRole('button', { name: labels.draft[0] })).toBeNull();
  });

  it('prevents mutations while a cached job detail is refreshing', () => {
    render(React.createElement(Harness, { initial: output(['common']), disabled: true }));
    fireEvent.click(screen.getByRole('button', { name: labels.common[1] }));
    expect(request).not.toHaveBeenCalled();
  });
});
