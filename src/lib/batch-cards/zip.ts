import fs from 'node:fs/promises';
import { createReadStream, createWriteStream, type ReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { ZipFile } from 'yazl';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceId, WorkspaceError } from '@/lib/workspaces/context';
import { withWorkspaceActivity } from '@/lib/workspaces/activity';
import { localContentPath } from '@/lib/workspaces/files';
import { readBatch } from './server';
import { cardIdSchema } from './types';

// Build a private snapshot before returning any bytes: a failed item never produces
// a silently incomplete download. Compressed image originals use ZIP STORE.
export async function preparePickedZip(batchId: string, signal?: AbortSignal) {
  const workspaceId = requireWorkspaceId();
  return withWorkspaceActivity(workspaceId, 'batch-pick-export', async () => {
    const batch = await readBatch(batchId);
    const picks = batch.document.cards.flatMap(card => {
      const row = card.rows.find(row => row.pick);
      return row ? [{ card, row }] : [];
    });
    if (!picks.length) throw new WorkspaceError('Choose at least one Pick before exporting ZIP.', 409);
    const names = new Set<string>();
    const originals: { name: string; source: string }[] = [];
    const root = await fs.realpath(path.join(process.cwd(), 'public'));
    for (const { card, row } of picks) {
      signal?.throwIfAborted();
      const id = cardIdSchema.safeParse(row.id);
      if (!id.success) throw new WorkspaceError(`Card "${row.card}" needs a valid id in its source JSON before ZIP export.`, 409);
      const identity = id.data.normalize('NFC').toLowerCase();
      if (names.has(identity)) throw new WorkspaceError(`Duplicate card id "${id.data}". Each picked card needs a unique id.`, 409);
      names.add(identity);
      const taskId = card.tasks[row.key];
      const task = taskId ? await prisma.cardBatchTask.findFirst({ where: { id: taskId, batchId, cardNumber: card.n, cardRevision: card.revision, variantKey: row.key } }) : null;
      if (!task || task.state !== 'completed' || !task.resultUrl) throw new WorkspaceError(`The Pick for "${row.card}" is not ready. Wait until generation and saving finish, then export again.`, 409);
      // Only the worker's preserved original inside this owner's registered folder.
      const prefix = `/generations/batch-cards/${workspaceId}/${task.id}.`;
      if (!task.resultUrl.startsWith(prefix)) throw new WorkspaceError(`Original for "${row.card}" is unavailable.`, 409);
      const local = localContentPath(task.resultUrl);
      if (!local) throw new WorkspaceError(`Original for "${row.card}" is unavailable.`, 409);
      const real = await fs.realpath(local).catch(() => null);
      const expectedRoot = path.join(root, 'generations', 'batch-cards', workspaceId) + path.sep;
      if (!real || !real.startsWith(expectedRoot)) throw new WorkspaceError(`Original for "${row.card}" is unavailable.`, 409);
      const ext = path.extname(real).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext) || !(await fs.stat(real)).isFile()) throw new WorkspaceError(`Original for "${row.card}" is not an image file.`, 409);
      originals.push({ name: id.data + ext, source: real });
    }
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'engui-card-picks-'));
    const cleanup = () => fs.rm(directory, { recursive: true, force: true });
    const inputs = new Set<ReadStream>();
    try {
      const zip = new ZipFile(), archive = path.join(directory, 'picked-images.zip');
      zip.on('error', error => (zip.outputStream as Readable).destroy(error));
      // Copy first so reimports or later curation cannot change a download midway.
      for (let index = 0; index < originals.length; index++) {
        signal?.throwIfAborted();
        const original = originals[index], snapshot = path.join(directory, `source-${index}`);
        await fs.copyFile(original.source, snapshot);
        const stat = await fs.stat(snapshot);
        zip.addReadStreamLazy(original.name, { size: stat.size, mtime: stat.mtime, compress: false }, callback => {
          const stream = createReadStream(snapshot); inputs.add(stream); stream.once('close', () => inputs.delete(stream)); callback(null, stream);
        });
      }
      const written = pipeline(zip.outputStream, createWriteStream(archive), { signal });
      zip.end(); await written;
      const size = (await fs.stat(archive)).size;
      return { archive, size, count: originals.length, filename: `${batch.title.replace(/[^a-z0-9_-]+/gi, '-').slice(0,100) || 'cards'}-picks.zip`, cleanup };
    } catch (error) { for (const stream of inputs) stream.destroy(); await cleanup(); throw error; }
  });
}
