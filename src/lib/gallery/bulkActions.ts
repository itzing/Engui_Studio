import { workspaceFetchFor } from '@/lib/workspaces/client';

export type GalleryBulkAction = 'favorite' | 'unfavorite' | 'trash' | 'restore';

// Explicit desired state, not toggle: mixed selections and retries are idempotent.
export async function runGalleryBulkAction(workspaceId: string, assetIds: string[], action: GalleryBulkAction, request = workspaceFetchFor(workspaceId)) {
  const ids = [...new Set(assetIds)];
  const succeeded: string[] = [];
  const failed: string[] = [];
  let cursor = 0;
  const favorite = action === 'favorite' || action === 'unfavorite';
  const body = JSON.stringify(favorite ? { favorited: action === 'favorite' } : { trashed: action === 'trash' });
  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const response = await request(`/api/gallery/assets/${encodeURIComponent(id)}/${favorite ? 'favorite' : 'trash'}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error('Asset update failed');
        succeeded.push(id);
      } catch { failed.push(id); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, worker));
  return { succeeded, failed };
}
