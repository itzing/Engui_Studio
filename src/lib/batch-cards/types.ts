import { z } from 'zod';

export const cardIdSchema = z.string().min(1).max(120).regex(/^[\p{L}\p{N}_-]+$/u, 'Card id must use letters, numbers, underscores or hyphens.');

export const rowSchema = z.object({
  id: cardIdSchema.optional(),
  key: z.string().min(1).max(160).refine(key => !Object.prototype.hasOwnProperty.call(Object.prototype, key) && key !== 'prototype', 'Reserved key'), n: z.number().int().positive().max(2147483647),
  card: z.string().min(1).max(300).refine(value => value.trim().length > 0, 'Must not be blank'), class: z.string().min(1).max(100).refine(value => value.trim().length > 0, 'Must not be blank'),
  effect: z.string().max(8000), variant: z.string().min(1).max(40).refine(value => value.trim().length > 0, 'Must not be blank'),
  route: z.string().min(1).max(100).refine(value => value.trim().length > 0, 'Must not be blank'), pick: z.boolean().default(false),
  stylePack: z.string().max(100).optional(), prompt: z.string().min(1).max(64000).refine(value => value.trim().length > 0, 'Must not be blank'),
}).passthrough();
export type CardRow = z.infer<typeof rowSchema>;
export type BatchCard = { n: number; revision: number; rows: CardRow[]; tasks: Record<string, string> };
export type BatchDocument = { cards: BatchCard[]; order: string[] };
export type TaskView = { id: string; key: string; jobId: string; state: string; error: string | null; resultUrl: string | null; thumbnailUrl: string | null; seed: number };
export const settingsSchema = z.object({
  modelId: z.string().default('krea2-turbo'),
  parameters: z.record(z.union([z.string(), z.number().finite(), z.boolean()])).default({}),
  loras: z.array(z.object({ id: z.string().uuid(), weight: z.number().finite().min(-10).max(10) })).max(8).default([]),
  randomizeSeed: z.boolean().default(true), seed: z.number().int().min(0).max(2147483646).default(42),
}).strict();
export type BatchSettings = z.infer<typeof settingsSchema>;
export const defaultBatchSettings: BatchSettings = { modelId: 'krea2-turbo', parameters: { width: 1024, height: 1024, steps: 8, cfg: 1, negativePrompt: '' }, loras: [], randomizeSeed: true, seed: 42 };
export type BatchView = { id: string; title: string; revision: number; document: BatchDocument; settings: BatchSettings; tasks: TaskView[] };
export const activeTaskStates = ['queued', 'submitting', 'running', 'submission_unknown'];

export function parseCardRows(input: unknown): CardRow[] {
  let value = input;
  if (typeof value === 'string') {
    if (value.length > 8 * 1024 * 1024) throw new Error('JSON exceeds 8 MB. Split it into smaller batches.');
    try { value = JSON.parse(value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch { throw new Error('Invalid JSON. Paste the complete array, including the closing ], without a trailing comma.'); }
  }
  const parsed = z.array(rowSchema).min(3).max(2500).safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid card data at ${issue.path.join('.') || 'root'}: ${issue.message}`);
  }
  const keys = new Set<string>(), groups = new Map<number, CardRow[]>();
  for (const row of parsed.data) {
    if (keys.has(row.key)) throw new Error(`Duplicate key: ${row.key}`);
    keys.add(row.key);
    const group = groups.get(row.n) || [];
    group.push(row); groups.set(row.n, group);
  }
  const cardIds = new Set<string>();
  for (const [n, rows] of groups) {
    if (rows.some(row => row.id !== rows[0].id)) throw new Error(`Card ${n} has inconsistent id values.`);
    if (rows[0].id) {
      const name = rows[0].id.normalize('NFC').toLowerCase();
      if (cardIds.has(name)) throw new Error(`Duplicate card id: ${rows[0].id}`);
      cardIds.add(name);
    }
    if (rows.length < 3 || rows.length > 5) throw new Error(`Card ${n} needs 3–5 variants (received ${rows.length}).`);
    if (new Set(rows.map(row => row.variant)).size !== rows.length) throw new Error(`Card ${n} has duplicate variant labels.`);
    if (rows.some(row => row.card !== rows[0].card || row.class !== rows[0].class || row.effect !== rows[0].effect)) throw new Error(`Card ${n} has inconsistent name, class or effect.`);
    if (rows.filter(row => row.pick).length > 1) throw new Error(`Card ${n} has more than one Pick.`);
  }
  return parsed.data;
}
export function documentFromRows(rows: CardRow[]): BatchDocument {
  const cards = new Map<number, BatchCard>();
  for (const row of rows) {
    if (!cards.has(row.n)) cards.set(row.n, { n: row.n, revision: 1, rows: [], tasks: {} });
    cards.get(row.n)!.rows.push({ ...row });
  }
  return { cards: [...cards.values()], order: rows.map(row => row.key) };
}
export function exportCardRows(document: BatchDocument): CardRow[] {
  const rows = new Map(document.cards.flatMap(card => card.rows.map(row => [row.key, row] as const)));
  return document.order.map(key => ({ ...rows.get(key)! }));
}
export function replaceCard(document: BatchDocument, number: number, rows: CardRow[]): BatchDocument {
  const old = document.cards.find(card => card.n === number);
  if (!old || rows.some(row => row.n !== number)) throw new Error('Replacement JSON must contain only the selected card number.');
  const otherKeys = new Set(document.cards.filter(card => card.n !== number).flatMap(card => card.rows.map(row => row.key)));
  if (rows.some(row => otherKeys.has(row.key))) throw new Error('A replacement key belongs to another card.');
  if (rows[0]?.id && document.cards.some(card => card.n !== number && card.rows[0].id?.normalize('NFC').toLowerCase() === rows[0].id!.normalize('NFC').toLowerCase())) throw new Error('This card id belongs to another card.');
  const oldKeys = new Set(old.rows.map(row => row.key));
  const first = document.order.findIndex(key => oldKeys.has(key));
  const order = document.order.filter(key => !oldKeys.has(key));
  order.splice(first, 0, ...rows.map(row => row.key));
  return { cards: document.cards.map(card => card.n === number ? { n: number, revision: old.revision + 1, rows: rows.map(row => ({ ...row, pick: false })), tasks: {} } : card), order };
}
export function cardIsReady(card: BatchCard, tasks: TaskView[]): boolean {
  const picked = card.rows.find(row => row.pick);
  return !!picked && tasks.some(task => task.id === card.tasks[picked.key] && task.state === 'completed' && !!task.resultUrl);
}

export function missingVariantKeys(document: BatchDocument): string[] {
  return document.cards.flatMap(card => card.rows.filter(row => !card.tasks[row.key]).map(row => row.key));
}
