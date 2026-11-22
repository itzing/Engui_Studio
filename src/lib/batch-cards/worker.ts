import fs from 'node:fs/promises';
import path from 'node:path';
import { readMedia } from '@/lib/mcp/media';
import { registerWorkspaceFile } from '@/lib/workspaces/files';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { workspaceContext } from '@/lib/workspaces/context';
import { withWorkspaceActivity } from '@/lib/workspaces/activity';
import { submitPreparedGeneration, type PreparedSubmission } from '@/lib/generation/submitFormData';
import { selectedLoras, modelConfiguration } from '@/lib/mcp/catalog';
import { getModelById } from '@/lib/models/modelConfig';
import { decodeDocument } from './server';
import { validateBatchSettings } from './settings';

export const batchProvider: { submit: (form: FormData, prepared: PreparedSubmission) => Promise<Response> } = { submit: submitPreparedGeneration };
const parsed = (s: string | null | undefined) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };
async function reconcile() {
  const rows = await prisma.cardBatchTask.findMany({ where: { OR: [{ state: { in: ['running', 'submitting', 'submission_unknown'] } }, { state: 'completed', resultUrl: null }] } });
  for (const t of rows) {
    const job = await prisma.job.findFirst({ where: { id: t.jobId } });
    const remote = t.providerJobId || job?.runpodJobId;
    if (job && ['completed', 'failed', 'cancelled', 'canceled'].includes(job.status)) {
      await prisma.cardBatchTask.update({ where: { id: t.id }, data: { state: job.status === 'canceled' ? 'cancelled' : job.status, error: job.error } });
    } else if (remote) {
      await prisma.cardBatchTask.update({ where: { id: t.id }, data: { state: 'running', providerJobId: remote } });
      if (job && ['submission_unknown', 'queueing_up'].includes(job.status)) await prisma.job.update({ where: { id: job.id }, data: { status: 'queued', runpodJobId: remote } });
    } else if (t.state === 'submitting' && (!t.leaseUntil || t.leaseUntil.getTime() < Date.now())) {
      const state = t.boundaryAt ? 'submission_unknown' : 'failed';
      const error = t.boundaryAt ? 'Submission acceptance unknown. Check the provider before retrying.' : 'Preparation interrupted. You can regenerate this variant.';
      await prisma.cardBatchTask.update({ where: { id: t.id }, data: { state, error } });
      await prisma.job.updateMany({ where: { id: t.jobId }, data: { status: state, error } });
    }
    if (job?.status === 'completed' && job.resultUrl && !t.resultUrl) {
      try {
        const image = await readMedia({ kind: 'job_output', jobId: t.jobId, outputId: 'output-1' });
        const ext = image.mime === 'image/jpeg' ? 'jpg' : image.mime === 'image/webp' ? 'webp' : 'png';
        const url = `/generations/batch-cards/${t.workspaceId}/${t.id}.${ext}`, file = path.join(process.cwd(), 'public', url);
        await fs.mkdir(path.dirname(file), { recursive: true }); await registerWorkspaceFile(file);
        await fs.writeFile(file, image.bytes);
        await prisma.cardBatchTask.update({ where: { id: t.id }, data: { resultUrl: url, thumbnailUrl: url, error: null } });
      } catch { /* Retry local preservation only; never repeat generation. */ }
    }
  }
}
async function claim() {
  return prisma.$transaction(async tx => {
    if (await tx.cardBatchTask.count({ where: { state: 'submitting' } })) return null;
    // Keep the provider queue bounded; the durable remainder stays in this application.
    if (await tx.job.count({ where: { status: { in: ['queued', 'processing', 'queueing_up', 'saving', 'uploading', 'finalizing', 'in_queue', 'in_progress'] } } }) >= 40) return null;
    const t = await tx.cardBatchTask.findFirst({ where: { state: 'queued' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    if (!t) return null;
    const token = randomUUID();
    const changed = await tx.cardBatchTask.updateMany({ where: { id: t.id, state: 'queued' }, data: { state: 'submitting', dispatchToken: token, leaseUntil: new Date(Date.now() + 180000) } });
    return changed.count ? { ...t, dispatchToken: token } : null;
  });
}
async function dispatch(t: NonNullable<Awaited<ReturnType<typeof claim>>>) {
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    const snap = parsed(t.snapshotJson), settings = validateBatchSettings(snap.settings);
    if (!(await modelConfiguration(settings.modelId)).configured) throw Error('Model connection is not configured.');
    const loras = await selectedLoras(settings.loras, settings.modelId);
    if (JSON.stringify(loras) !== JSON.stringify(snap.loras)) throw Error('Selected LoRAs changed. Regenerate with current settings.');
    const form = new FormData();
    const model = getModelById(settings.modelId)!;
    const defaults = Object.fromEntries(model.parameters.filter(p => p.default !== undefined && p.type !== 'lora-selector' && !/^loraWeight/.test(p.name)).map(p => [p.name, p.default]));
    for (const [key, value] of Object.entries({ ...defaults, ...settings.parameters, userId: 'user-with-settings', workspaceId: t.workspaceId, modelId: settings.modelId, jobId: t.jobId, language: 'en', prompt: snap.prompt, randomizeSeed: 'false', seed: snap.seed })) form.set(key, String(value));
    for (let i = 0; i < settings.loras.length; i++) {
      const l = await prisma.loRA.findFirst({ where: { id: settings.loras[i].id, lifecycle: 'active' } });
      if (!l?.sourceKey) throw Error('Selected LoRA is unavailable.');
      form.set(i ? `lora${i + 1}` : 'lora', l.sourceKey);
      form.set(i ? `loraWeight${i + 1}` : 'loraWeight', String(settings.loras[i].weight));
    }
    timer = setInterval(() => { void prisma.cardBatchTask.updateMany({ where: { id: t.id, dispatchToken: t.dispatchToken, state: 'submitting' }, data: { leaseUntil: new Date(Date.now() + 180000) } }).catch(() => undefined); }, 30000);
    timer.unref?.();
    await withWorkspaceActivity(t.workspaceId, 'card-batch-dispatch', async () => {
      const response = await batchProvider.submit(form, {
        prompt: snap.prompt, metadata: { kind: 'card_batch', batchId: t.batchId, taskId: t.id, cardNumber: t.cardNumber, cardRevision: t.cardRevision, variantKey: t.variantKey },
        beforeProviderSubmit: async evidence => {
          await prisma.$transaction(async tx => {
            const b = await tx.cardBatch.findFirst({ where: { id: t.batchId, deletedAt: null } });
            const card = b && decodeDocument(b.documentJson).cards.find(c => c.n === t.cardNumber);
            if (!card || card.revision !== t.cardRevision || card.tasks[t.variantKey] !== t.id) throw Error('Card was replaced before dispatch.');
            const changed = await tx.cardBatchTask.updateMany({ where: { id: t.id, state: 'submitting', dispatchToken: t.dispatchToken, boundaryAt: null, leaseUntil: { gt: new Date() } }, data: { boundaryAt: new Date(), leaseUntil: new Date(Date.now() + 180000) } });
            if (changed.count !== 1) throw Error('Dispatch ownership lost.');
            await tx.job.update({ where: { id: t.jobId }, data: { endpointId: evidence.endpointId, secureState: evidence.secureState ? JSON.stringify(evidence.secureState) : null } });
          });
        },
        afterProviderAccepted: async remote => {
          await prisma.$transaction(async tx => {
            const job = await tx.job.findFirst({ where: { id: t.jobId } }), secure = parsed(job?.secureState);
            await tx.cardBatchTask.update({ where: { id: t.id }, data: { state: 'running', providerJobId: remote, error: null } });
            await tx.job.update({ where: { id: t.jobId }, data: { runpodJobId: remote, status: 'queued', secureState: JSON.stringify({ ...secure, phase: 'runpod_queued', activeAttempt: { ...secure.activeAttempt, runpodJobId: remote } }) } });
          });
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Object.assign(Error('Generation submission failed.'), { code: body.code });
      }
    });
  } catch (error: any) {
    const current = await prisma.cardBatchTask.findFirst({ where: { id: t.id } });
    if (!current || current.providerJobId) return; // Accepted requests are reconciled, never resubmitted.
    if (current.state === 'cancelled') { await prisma.job.updateMany({ where: { id: t.jobId, runpodJobId: null }, data: { status: 'failed', error: 'cancelled' } }); return; }
    const unknown = !!current.boundaryAt && error?.code !== 'PROVIDER_REJECTED';
    const state = unknown ? 'submission_unknown' : 'failed';
    const message = unknown ? 'Submission acceptance unknown. Check the provider before retrying.' : 'Generation could not start. Check model settings and selected LoRAs, then regenerate.';
    await prisma.cardBatchTask.update({ where: { id: t.id }, data: { state, error: message } });
    await prisma.job.updateMany({ where: { id: t.jobId }, data: { status: state, error: message } });
  } finally { if (timer) clearInterval(timer); }
}
export async function processCardBatchWorkspace(workspaceId: string) {
  return workspaceContext.run({ kind: 'workspace', workspaceId, userId: 'user-with-settings' }, async () => {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws || ws.lifecycle !== 'active') return;
    await reconcile(); const task = await claim(); if (task) await dispatch(task);
  });
}
export async function processCardBatchesOnce() {
  const spaces = await prisma.workspace.findMany({ where: { lifecycle: 'active', userId: 'user-with-settings' }, select: { id: true } });
  for (const ws of spaces) await processCardBatchWorkspace(ws.id);
}
const shared = globalThis as typeof globalThis & { cardBatchTimer?: ReturnType<typeof setInterval>; cardBatchBusy?: boolean };
export function startCardBatchWorker() {
  if (process.env.ENGUI_ISOLATED_VALIDATION === '1' || shared.cardBatchTimer) return;
  const tick = async () => { if (shared.cardBatchBusy) return; shared.cardBatchBusy = true;
    try { await processCardBatchesOnce(); } catch { console.error('Card batch cycle failed; no automatic submission retry.'); } finally { shared.cardBatchBusy = false; } };
  shared.cardBatchTimer = setInterval(() => void tick(), 3000); shared.cardBatchTimer.unref?.(); void tick();
}
