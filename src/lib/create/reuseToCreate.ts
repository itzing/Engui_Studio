'use client';

import { persistCreateReuseDraft } from '@/lib/create/persistCreateReuseDraft';
import { announceCreateModeChange } from '@/lib/create/createModeEvents';

type CreateReuseAction = 'txt2img' | 'img2img' | 'img2vid';

type CreateReuseSource =
  | { kind: 'gallery-asset'; id: string }
  | { kind: 'job'; id: string; outputId?: string };

export async function prepareCreateReuseDraft(source: CreateReuseSource, action: CreateReuseAction) {
  const endpoint = source.kind === 'gallery-asset'
    ? `/api/gallery/assets/${source.id}/reuse`
    : `/api/jobs/${source.id}/reuse`;
  const body = source.kind === 'gallery-asset'
    ? { action }
    : { action, outputId: source.outputId || 'output-1' };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (!response.ok || !data.success || !data.payload) {
    throw new Error(data.error || 'Failed to prepare reuse payload');
  }

  const result = persistCreateReuseDraft(data.payload);
  if (result?.workflow) {
    announceCreateModeChange(result.workflow);
  }

  return result;
}
