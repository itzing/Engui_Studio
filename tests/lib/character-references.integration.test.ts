import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const provider = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock('@/lib/runpodService', () => ({ default: class { submitJob(...args: any[]) { return provider.submit(...args); } } }));
vi.mock('@/lib/settingsService', () => ({ default: class { async getSettings() { return { settings: {
  runpod: { apiKey: 'fixture-only', fieldEncKeyB64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', endpoints: { 'krea2-turbo': 'fixture-krea', 'wan22-t2v': 'fixture-wan' } },
  s3: { endpointUrl: 'https://fixture.invalid', accessKeyId: 'fixture', secretAccessKey: 'fixture', bucketName: 'fixture' },
} }; } } }));
vi.mock('@/lib/runpodSupervisor', () => ({ startRunPodSupervisor: vi.fn() }));
import { prisma } from '@/lib/prisma';
import { workspaceContext } from '@/lib/workspaces/context';
import { decryptStructuredEnvelope } from '@/lib/secureTransport';
import { POST as generate } from '@/app/api/generate/route';
import { POST as preview } from '@/app/api/create/prompt-preview/route';
import { POST as reuseJob } from '@/app/api/jobs/[id]/reuse/route';
import { POST as reuseAsset } from '@/app/api/gallery/assets/[id]/reuse/route';
import { renderCreatePrompt } from '@/lib/generation/renderCreatePrompt';
const scope = <T>(id: string, fn: () => T) => workspaceContext.run({ kind: 'workspace', workspaceId: id }, fn);
const submit = provider.submit;
let ws: string, otherWs: string, characterId: string, outfitId: string;
const tag = () => `{character:${characterId}:withOutfit}`;
const jsonRequest = (path: string, body: object, owner = ws) => new Request('http://localhost'+path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-workspace-id': owner }, body: JSON.stringify(body) });
beforeAll(async () => {
  if (!process.env.ENGUI_DATABASE_URL?.includes('engui-601-test.db')) throw new Error('An isolated character-reference test DB is required.');
  ws = randomUUID(); otherWs = randomUUID();
  await prisma.workspace.createMany({ data: [ws, otherWs].map(id => ({ id, name: 'Character reference fixture '+id, userId: 'user-with-settings' })) });
  await scope(ws, async () => {
    const character = await prisma.character.create({ data: { workspaceId: ws, name: 'Fixture Alice', gender: 'female', traits: JSON.stringify({ hair_color: 'copper' }) } }); characterId = character.id;
    const outfit = await prisma.outfit.create({ data: { workspaceId: ws, ownerCharacterId: characterId, name: 'Fixture outfit', description: 'blue coat' } }); outfitId = outfit.id;
    await prisma.character.update({ where: { id: characterId }, data: { defaultOutfitId: outfitId } });
  });
});
beforeEach(() => { submit.mockReset().mockResolvedValue('fixture-remote'); vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Network is forbidden in Character integration tests.'); })); });
afterAll(async () => { vi.unstubAllGlobals(); await prisma.$disconnect(); });
async function generateFixture(modelId: string, prompt: string, enabled = true) {
  const form = new FormData();
  for (const [key,value] of Object.entries({ modelId, workspaceId: ws, prompt, seed: '42', width: '832', height: '480', language: 'en' })) form.set(key,value);
  if (enabled) form.set('enableCharacterReferences','true');
  return generate(new Request('http://localhost/api/generate', { method: 'POST', headers: { 'x-workspace-id': ws }, body: form }));
}
describe('Create Character references HTTP and persistence', () => {
  it.each(['krea2-turbo','wan22-t2v'])('sends only rendered text to %s and preserves source plus snapshots', async model => {
    const source = `Portrait ${tag()} with {red|blue} light`;
    const p = await preview(jsonRequest('/api/create/prompt-preview', { prompt: source, seed: 42 }));
    expect(p.status).toBe(200); const rendered = await p.json();
    const response = await generateFixture(model,source); const body = await response.json();
    expect(response.status,JSON.stringify(body)).toBe(200);
    expect(submit).toHaveBeenCalledOnce();
    const input = submit.mock.calls[0][0] as any;
    const sent = decryptStructuredEnvelope<any>(Buffer.alloc(32),input._secure,input._secure.binding);
    expect(sent.prompt || sent.positive_prompt).toBe(rendered.prompt);
    expect(body.prompt).toBe(source); expect(body.resolvedPrompt).toBe(rendered.prompt);
    const job = await scope(ws, () => prisma.job.findFirstOrThrow({ where: { id: body.jobId } }));
    const options = JSON.parse(job.options!);
    expect(job.prompt).toBe(source); expect(options.promptTemplate).toBe(source);
    expect(options.resolvedPrompt).toBe(rendered.prompt);
    expect(options.characterReferences[0]).toMatchObject({ characterId, outfitId, outfitRevision: 1 });
  });
  it('rejects inaccessible tags before any job creation or provider call', async () => {
    const foreign = await scope(otherWs, () => prisma.character.create({ data: { workspaceId: otherWs, name: 'Foreign' } }));
    const before = await scope(ws, () => prisma.job.count());
    const response = await generateFixture('krea2-turbo',`{character:${foreign.id}}`);
    expect(response.status).toBe(422); expect(submit).not.toHaveBeenCalled();
    expect(await scope(ws, () => prisma.job.count())).toBe(before);
    const p = await preview(jsonRequest('/api/create/prompt-preview', { prompt: `{character:${foreign.id}}` }));
    expect(p.status).toBe(422);
  });
  it('does not enable tag interpretation for excluded submitters', async () => {
    const source = `{character:${characterId}}`;
    const response = await generateFixture('krea2-turbo',source,false); const body = await response.json();
    expect(response.status,JSON.stringify(body)).toBe(200);
    const input = submit.mock.calls[0][0] as any;
    const sent = decryptStructuredEnvelope<any>(Buffer.alloc(32),input._secure,input._secure.binding);
    expect(sent.prompt).toBe(source);
  });
  it('returns tags on Job/Gallery Reuse and resolves current edits without rewriting history', async () => {
    const source = tag();
    const response = await generateFixture('krea2-turbo',source); const generated = await response.json();
    expect(response.status,JSON.stringify(generated)).toBe(200);
    const old = await scope(ws, () => prisma.job.update({ where: { id: generated.jobId }, data: { status: 'completed', resultUrl: '/fixture.png' } }));
    const options = JSON.parse(old.options!);
    const asset = await scope(ws, () => prisma.galleryAsset.create({ data: { workspaceId: ws, type: 'image', originalUrl: '/fixture.png', contentHash: randomUUID(), generationSnapshot: JSON.stringify({ ...options, modelId: 'krea2-turbo', prompt: source }) } }));
    await scope(ws, async () => {
      await prisma.character.update({ where: { id: characterId }, data: { traits: JSON.stringify({ hair_color: 'blonde' }) } });
      await prisma.outfit.update({ where: { id: outfitId }, data: { description: 'black coat', revision: { increment: 1 } } });
    });
    const reusedJob = await reuseJob(jsonRequest('/api/jobs/'+old.id+'/reuse', { action: 'txt2img', outputId: 'output-1' }), { params: Promise.resolve({ id: old.id }) });
    expect(reusedJob.status,await reusedJob.clone().text()).toBe(200);
    expect((await reusedJob.json()).payload.prompt).toBe(source);
    const reusedAsset = await reuseAsset(jsonRequest('/api/gallery/assets/'+asset.id+'/reuse', { action: 'txt2img' }), { params: Promise.resolve({ id: asset.id }) });
    expect(reusedAsset.status,await reusedAsset.clone().text()).toBe(200);
    expect((await reusedAsset.json()).payload.prompt).toBe(source);
    const current = await scope(ws, () => renderCreatePrompt({ prompt: source, workspaceId: ws, seed: 42 }));
    expect(current.prompt).toContain('blonde'); expect(current.prompt).toContain('black coat');
    const unchanged = await scope(ws, () => prisma.job.findFirstOrThrow({ where: { id: old.id } }));
    expect(unchanged.options).toBe(old.options); expect(options.resolvedPrompt).toContain('copper');
  });
});
