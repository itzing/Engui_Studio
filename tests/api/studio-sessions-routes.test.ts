import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateStudioSessionRun,
  mockListStudioSessionRuns,
  mockCreateStudioSessionTemplate,
  mockUpdateStudioSessionShotSkipState,
  mockUpdateStudioSessionShotVersionReviewState,
  mockAddStudioSessionShotVersionToGallery,
} = vi.hoisted(() => ({
  mockCreateStudioSessionRun: vi.fn(),
  mockListStudioSessionRuns: vi.fn(),
  mockCreateStudioSessionTemplate: vi.fn(),
  mockUpdateStudioSessionShotSkipState: vi.fn(),
  mockUpdateStudioSessionShotVersionReviewState: vi.fn(),
  mockAddStudioSessionShotVersionToGallery: vi.fn(),
}));

vi.mock('@/lib/studio-sessions/server', () => ({
  createStudioSessionRun: mockCreateStudioSessionRun,
  listStudioSessionRuns: mockListStudioSessionRuns,
  createStudioSessionTemplate: mockCreateStudioSessionTemplate,
  updateStudioSessionShotSkipState: mockUpdateStudioSessionShotSkipState,
  updateStudioSessionShotVersionReviewState: mockUpdateStudioSessionShotVersionReviewState,
  addStudioSessionShotVersionToGallery: mockAddStudioSessionShotVersionToGallery,
}));

import { POST as createRun } from '@/app/api/studio-sessions/runs/route';
import { POST as createTemplate } from '@/app/api/studio-sessions/templates/route';
import { PATCH as patchSkip } from '@/app/api/studio-sessions/shots/[id]/skip/route';
import { PATCH as patchReviewState } from '@/app/api/studio-sessions/shots/[id]/versions/[versionId]/review-state/route';
import { POST as addToGallery } from '@/app/api/studio-sessions/shots/[id]/versions/[versionId]/add-to-gallery/route';

describe('studio session API validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed JSON when creating a run', async () => {
    const response = await createRun(new Request('http://localhost/api/studio-sessions/runs', {
      method: 'POST',
      body: '{bad json',
      headers: { 'Content-Type': 'application/json' },
    }) as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid JSON body');
    expect(mockCreateStudioSessionRun).not.toHaveBeenCalled();
  });

  it('rejects missing workspaceId when creating a template', async () => {
    const response = await createTemplate(new Request('http://localhost/api/studio-sessions/templates', {
      method: 'POST',
      body: JSON.stringify({ name: 'Draft' }),
      headers: { 'Content-Type': 'application/json' },
    }) as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('workspaceId is required');
    expect(mockCreateStudioSessionTemplate).not.toHaveBeenCalled();
  });

  it('rejects skip payloads without a boolean', async () => {
    const response = await patchSkip(new Request('http://localhost/api/studio-sessions/shots/shot-1/skip', {
      method: 'PATCH',
      body: JSON.stringify({ skipped: 'yes' }),
      headers: { 'Content-Type': 'application/json' },
    }) as any, { params: Promise.resolve({ id: 'shot-1' }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('skipped boolean is required');
    expect(mockUpdateStudioSessionShotSkipState).not.toHaveBeenCalled();
  });

  it('rejects review-state payloads that do not include hidden or rejected booleans', async () => {
    const response = await patchReviewState(new Request('http://localhost/api/studio-sessions/shots/shot-1/versions/version-1/review-state', {
      method: 'PATCH',
      body: JSON.stringify({ note: 'no-op' }),
      headers: { 'Content-Type': 'application/json' },
    }) as any, { params: Promise.resolve({ id: 'shot-1', versionId: 'version-1' }) });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('hidden or rejected boolean is required');
    expect(mockUpdateStudioSessionShotVersionReviewState).not.toHaveBeenCalled();
  });

  it('normalizes unsupported gallery buckets to common', async () => {
    mockAddStudioSessionShotVersionToGallery.mockResolvedValue({ alreadyInGallery: false, asset: { id: 'asset-1' } });

    const response = await addToGallery(new Request('http://localhost/api/studio-sessions/shots/shot-1/versions/version-1/add-to-gallery', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'weird' }),
      headers: { 'Content-Type': 'application/json' },
    }) as any, { params: Promise.resolve({ id: 'shot-1', versionId: 'version-1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockAddStudioSessionShotVersionToGallery).toHaveBeenCalledWith({ shotId: 'shot-1', versionId: 'version-1', bucket: 'common' });
    expect(json.bucket).toBe('common');
  });
});
