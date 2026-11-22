import { createHash, randomInt, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceId, WorkspaceError } from '@/lib/workspaces/context';
import { modelConfiguration, selectedLoras } from '@/lib/mcp/catalog';
import { validateBatchSettings } from './settings';
import { activeTaskStates, defaultBatchSettings, documentFromRows, exportCardRows, parseCardRows, replaceCard, type BatchDocument, type BatchSettings, type BatchView } from './types';

export const decodeDocument = (value: string): BatchDocument => JSON.parse(value);
export async function readBatch(id: string): Promise<BatchView> {
  const row = await prisma.cardBatch.findFirst({ where: { id, deletedAt: null } });
  if (!row) throw new WorkspaceError('Batch not found.', 404);
  const document = decodeDocument(row.documentJson);
  const ids = document.cards.flatMap(card => Object.values(card.tasks));
  const tasks = ids.length ? await prisma.cardBatchTask.findMany({ where: { id: { in: ids }, batchId: id } }) : [];
  const jobs = tasks.length ? await prisma.job.findMany({ where: { id: { in: tasks.map(task => task.jobId) } }, select: { id: true, status: true, resultUrl: true, thumbnailUrl: true, error: true } }) : [];
  const jobMap = new Map(jobs.map(job => [job.id, job]));
  return { id: row.id, title: row.title, revision: row.revision, document, settings: JSON.parse(row.settingsJson), tasks: tasks.map(task => {
    const job = jobMap.get(task.jobId);
    const state = job?.status === 'completed' ? 'completed' : task.state === 'cancelled' ? 'cancelled' : job?.status === 'failed' ? 'failed' : job?.status === 'submission_unknown' ? 'submission_unknown' : task.state === 'running' ? (job?.status || 'queued') : task.state;
    return { id: task.id, key: task.variantKey, jobId: task.jobId, state, error: task.error || job?.error || null,
      resultUrl: state === 'completed' ? task.resultUrl || job?.resultUrl || null : null, thumbnailUrl: state === 'completed' ? task.thumbnailUrl || job?.thumbnailUrl || null : null, seed: JSON.parse(task.snapshotJson).seed };
  }) };
}
export async function listBatches() {
  const rows = await prisma.cardBatch.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, updatedAt: true, documentJson: true } });
  return rows.map(row => ({ id: row.id, title: row.title, updatedAt: row.updatedAt, cardCount: decodeDocument(row.documentJson).cards.length }));
}
export async function createBatch(title: string, input: unknown) {
  if (!title.trim() || title.length > 160) throw new WorkspaceError('Enter a batch name (up to 160 characters).', 400);
  const document = documentFromRows(parseCardRows(input));
  const row = await prisma.cardBatch.create({ data: { workspaceId: requireWorkspaceId(), title: title.trim(), documentJson: JSON.stringify(document), settingsJson: JSON.stringify(defaultBatchSettings) } });
  return readBatch(row.id);
}
async function editable(tx: any, id: string, revision: number) {
  const batch = await tx.cardBatch.findFirst({ where: { id, deletedAt: null } });
  if (!batch) throw new WorkspaceError('Batch not found.', 404);
  if (batch.revision !== revision) throw new WorkspaceError('This batch changed in another tab. Refresh and try again.', 409);
  return batch;
}
async function saveDocument(tx: any, id: string, revision: number, document: BatchDocument, extra = {}) {
  const changed = await tx.cardBatch.updateMany({ where: { id, revision }, data: { ...extra, documentJson: JSON.stringify(document), revision: { increment: 1 } } });
  if (changed.count !== 1) throw new WorkspaceError('This batch changed. Refresh and try again.', 409);
}
async function cancelUnsubmittedTasks(tx: any, batchId: string, reason: string, cardNumber?: number) {
  const where = { batchId, ...(cardNumber === undefined ? {} : { cardNumber }), OR: [{ state: 'queued' }, { state: 'submitting', boundaryAt: null, providerJobId: null }] };
  const tasks = await tx.cardBatchTask.findMany({ where, select: { jobId: true } });
  await tx.cardBatchTask.updateMany({ where, data: { state: 'cancelled', error: reason, dispatchToken: null, leaseUntil: null } });
  if (tasks.length) await tx.job.updateMany({ where: { id: { in: tasks.map((t: { jobId: string }) => t.jobId) }, runpodJobId: null, status: { in: ['queueing_up', 'queued'] } }, data: { status: 'failed', error: 'cancelled' } });
}
export async function deleteBatch(id: string, revision: number) {
  await prisma.$transaction(async tx => {
    await editable(tx, id, revision);
    await cancelUnsubmittedTasks(tx, id, 'Batch was deleted.');
    const changed = await tx.cardBatch.updateMany({ where: { id, revision, deletedAt: null }, data: { deletedAt: new Date(), revision: { increment: 1 } } });
    if (changed.count !== 1) throw new WorkspaceError('This batch changed. Refresh and try again.', 409);
  });
  return { deletedBatchId: id };
}
export async function updateBatch(id: string, revision: number, action: { kind: string; cardNumber?: number; key?: string; rows?: unknown; settings?: unknown }) {
  const rows = ['replace', 'replace_batch'].includes(action.kind) ? parseCardRows(action.rows) : null;
  const settings = action.kind === 'settings' ? validateBatchSettings(action.settings) : null;
  await prisma.$transaction(async tx => {
    const batch = await editable(tx, id, revision);
    let document = decodeDocument(batch.documentJson);
    if (action.kind === 'replace_batch' && rows) {
      const revision = Math.max(batch.revision, ...document.cards.map(card => card.revision)) + 1;
      document = documentFromRows(rows.map(row => ({ ...row, pick: false })));
      for (const card of document.cards) card.revision = revision;
      await cancelUnsubmittedTasks(tx, id, 'Batch JSON was replaced.');
    } else if (action.kind === 'replace' && rows && action.cardNumber !== undefined) {
      document = replaceCard(document, action.cardNumber, rows);
      await cancelUnsubmittedTasks(tx, id, 'Card JSON was replaced.', action.cardNumber);
    } else if (action.kind === 'pick') {
      const card = document.cards.find(card => card.n === action.cardNumber);
      const row = card?.rows.find(row => row.key === action.key);
      if (!card || !row) throw new WorkspaceError('Variant not found.', 404);
      const clear = row.pick;
      if (!clear) {
        const task = card.tasks[row.key] ? await tx.cardBatchTask.findFirst({ where: { id: card.tasks[row.key], batchId: id } }) : null;
        const job = task ? await tx.job.findFirst({ where: { id: task.jobId } }) : null;
        if (!(task?.state === 'completed' && task.resultUrl) && (!job || job.status !== 'completed' || !job.resultUrl)) throw new WorkspaceError('Generate this variant before choosing it.', 409);
      }
      for (const variant of card.rows) variant.pick = !clear && variant.key === row.key;
    } else if (!settings) throw new WorkspaceError('Unknown batch action.', 400);
    await saveDocument(tx, id, revision, document, settings ? { settingsJson: JSON.stringify(settings) } : {});
  });
  return readBatch(id);
}
export async function exportBatch(id: string) { return exportCardRows((await readBatch(id)).document); }

export async function queueVariants(id: string, revision: number, keys: string[], requestKey: string) {
  if (!Array.isArray(keys) || !keys.length || keys.length > 2500 || new Set(keys).size !== keys.length || keys.some(key => typeof key !== 'string')) throw new WorkspaceError('Choose one or more distinct variants.', 400);
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(requestKey)) throw new WorkspaceError('Invalid generation request key.', 400);
  const workspaceId = requireWorkspaceId();
  const digest = createHash('sha256').update(JSON.stringify({ revision, keys: [...keys].sort() })).digest('hex');
  const previous = await prisma.cardBatchTask.findMany({ where: { batchId: id, requestKey } });
  if (previous.length) {
    if (previous.length !== keys.length || previous.some(task => JSON.parse(task.snapshotJson).requestDigest !== digest)) throw new WorkspaceError('Request key already used for a different selection.', 409);
    return readBatch(id);
  }
  const view = await readBatch(id);
  const settings = validateBatchSettings(view.settings);
  if (!(await modelConfiguration(settings.modelId)).configured) throw new WorkspaceError('This model is not configured. Check Settings or choose another model.', 400);
  const loras = await selectedLoras(settings.loras, settings.modelId);
  await prisma.$transaction(async tx => {
    // The initial receipt check may race another identical request; recheck inside the transaction.
    const duplicate = await tx.cardBatchTask.findMany({ where: { batchId: id, requestKey } });
    if (duplicate.length) {
      if (duplicate.length !== keys.length || duplicate.some(task => JSON.parse(task.snapshotJson).requestDigest !== digest)) throw new WorkspaceError('Request key already used.', 409);
      return;
    }
    const batch = await editable(tx, id, revision);
    const document = decodeDocument(batch.documentJson);
    const seeds = new Set<number>();
    for (const key of keys) {
      const card = document.cards.find(card => card.rows.some(row => row.key === key));
      const row = card?.rows.find(row => row.key === key);
      if (!card || !row) throw new WorkspaceError('Variant not found.', 404);
      const old = card.tasks[key] ? await tx.cardBatchTask.findFirst({ where: { id: card.tasks[key] } }) : null;
      if (old && activeTaskStates.includes(old.state)) {
        const job = await tx.job.findFirst({ where: { id: old.jobId } });
        if (!job || !['completed', 'failed', 'cancelled', 'canceled'].includes(job.status)) throw new WorkspaceError(`Variant ${row.variant} is already active.`, 409);
      }
      let seed = settings.randomizeSeed ? randomInt(0, 2147483647) : settings.seed;
      if (settings.randomizeSeed) while (seeds.has(seed)) seed = randomInt(0, 2147483647);
      seeds.add(seed);
      const task = await tx.cardBatchTask.create({ data: { workspaceId, batchId: id, cardNumber: card.n, cardRevision: card.revision, variantKey: key, requestKey,
        jobId: randomUUID(), snapshotJson: JSON.stringify({ prompt: row.prompt, settings, loras, seed, requestDigest: digest }), state: 'queued' } });
      card.tasks[key] = task.id;
      // A regenerated picked variant must be reviewed again; unrelated Picks stay intact.
      if (old) row.pick = false;
    }
    await saveDocument(tx, id, revision, document);
  });
  return readBatch(id);
}
