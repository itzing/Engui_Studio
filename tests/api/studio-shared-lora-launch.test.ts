import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const fakes = vi.hoisted(() => ({ submit: vi.fn(), supervisor: vi.fn() }));
vi.mock('@/lib/runpodService', () => ({ default: class { submitJob = fakes.submit; } }));
vi.mock('@/lib/runpodSupervisor', () => ({ startRunPodSupervisor: fakes.supervisor }));
vi.mock('@/lib/settingsService', () => ({ default: class {
  async getSettings() {
    return { settings: {
      runpod: { apiKey: 'offline-test-key', endpoints: { 'krea2-turbo': 'offline-test-endpoint' }, fieldEncKeyB64: Buffer.alloc(32, 1).toString('base64') },
      s3: { endpointUrl: 'https://storage.invalid', bucketName: 'offline', accessKeyId: 'offline', secretAccessKey: 'offline' },
    }, status: {} };
  }
} }));
vi.mock('@/lib/s3Service', () => ({ default: class {} }));

// A copied schema/data set is required; normal unit runs skip this integration suite.
const isolated = process.env.ENGUI_DATABASE_URL?.startsWith('file:/var/tmp/engui-studio-launch-');
describe.skipIf(!isolated)('Studio launch with shared LoRAs and real workspace guards', () => {
  let prisma: any, context: any, pins: any, createSession: any, createRun: any, launch: any, generate: any;
  let owner: string, consumer: string, character: string, portfolio: string, poseSet: string;
  let shared: any, privateLora: any, own: any;
  let localFetch: any;
  const scope = (id: string, fn: () => Promise<any>) => context.run({ kind: 'workspace', workspaceId: id }, async () => await fn());
  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    ({ workspaceContext: context } = await import('@/lib/workspaces/context'));
    ({ withGenerationLoraPins: pins } = await import('@/lib/workspaces/loraAccess'));
    ({ createStudioPhotoSession: createSession, createStudioPhotoSessionRun: createRun } = await import('@/lib/studio-sessions/portfolioServer'));
    ({ POST: launch } = await import('@/app/api/studio/runs/[id]/launch/route'));
    ({ POST: generate } = await import('@/app/api/generate/route'));
    const { storageFingerprint } = await import('@/lib/workspaces/storage');
    const { getStudioPoseSets } = await import('@/lib/studio-sessions/poseSets');
    owner = (await prisma.workspace.findFirstOrThrow({ where: { userId: 'user-with-settings', isProtected: true } })).id;
    consumer = randomUUID(); character = randomUUID(); portfolio = randomUUID();
    await prisma.workspace.create({ data: { id: consumer, userId: 'user-with-settings', name: 'Consumer QA ' + consumer } });
    const makeLora = (workspaceId: string, isShared: boolean) => {
      const id = randomUUID(), key = 'loras/test-' + id + '.safetensors';
      return prisma.loRA.create({ data: { id, workspaceId, isShared, name: id, fileName: id + '.safetensors', s3Path: '/runpod-volume/' + key, sourceKey: key,
        s3Url: 'https://storage.invalid/' + key, fileSize: 1n, extension: '.safetensors', baseModel: 'krea2-turbo', lifecycle: 'active',
        storageTarget: storageFingerprint('https://storage.invalid', 'offline') } });
    };
    await scope(owner, async () => { shared = await makeLora(owner, true); privateLora = await makeLora(owner, false); });
    await scope(consumer, async () => {
      own = await makeLora(consumer, false);
      await prisma.character.create({ data: { id: character, workspaceId: consumer, name: 'QA subject', traits: '{"hair_color":"black"}' } });
      await prisma.studioPortfolio.create({ data: { id: portfolio, workspaceId: consumer, characterId: character, name: 'QA Portfolio' } });
      poseSet = (await getStudioPoseSets(consumer)).find((p: any) => p.name === 'Editorial Dynamic')!.id;
    });
    localFetch = vi.fn(async (input: any, init: any) => {
      const url = String(input);
      if (url !== 'http://127.0.0.1:3010/api/generate') throw new Error('NETWORK_FORBIDDEN');
      return generate(new Request(url, init));
    });
    vi.stubGlobal('fetch', localFetch);
  }, 30000);
  afterAll(async () => {
    vi.useRealTimers(); vi.unstubAllGlobals();
    // The entire copied database is disposable, including mock jobs and their
    // materialization relations. Never clean fixtures in the live database.
    if (prisma) await prisma.$disconnect();
  });

  const form = (...rows: any[]) => {
    const body = new FormData();
    body.set('modelId', 'krea2-turbo'); body.set('workspaceId', consumer); body.set('prompt', 'Offline test');
    rows.forEach((row, i) => body.set(i ? 'lora' + (i + 1) : 'lora', row.s3Path));
    return body;
  };
  async function draft(count = 1) {
    return scope(consumer, async () => {
      const session = await createSession(portfolio, { name: 'Offline session' });
      const result = await createRun(session.id, { poseSetId: poseSet, count, generationSettings: { modelId: 'krea2-turbo', lora: shared.s3Path } });
      return result.run;
    });
  }
  async function requestLaunch(id: string) {
    return launch(new Request('http://localhost/api/studio/runs/' + id + '/launch', { method: 'POST', headers: { 'x-workspace-id': consumer } }),
      { params: Promise.resolve({ id }) });
  }

  it('creates, renews and cleans owner leases without changing the consumer context', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    try {
      await scope(consumer, () => pins(form(shared, shared, own), async () => {
        expect(context.getStore().workspaceId).toBe(consumer);
        const sourcePins = await scope(owner, () => prisma.workspaceActivity.findMany({ where: { kind: 'lora-use:' + shared.id } }));
        expect(sourcePins).toHaveLength(1);
        const first = sourcePins[0].expiresAt.getTime();
        expect(await prisma.workspaceActivity.count({ where: { kind: 'lora-use:' + own.id } })).toBe(1);
        await vi.advanceTimersByTimeAsync(30001);
        await vi.waitFor(async () => {
          const updated = await scope(owner, () => prisma.workspaceActivity.findUnique({ where: { id: sourcePins[0].id } }));
          expect(updated.expiresAt.getTime()).toBeGreaterThan(first);
        });
        expect(context.getStore().workspaceId).toBe(consumer);
      }));
    } finally { vi.useRealTimers(); }
    expect(await scope(owner, () => prisma.workspaceActivity.count({ where: { kind: 'lora-use:' + shared.id } }))).toBe(0);
    expect(await scope(consumer, () => prisma.workspaceActivity.count({ where: { kind: 'lora-use:' + own.id } }))).toBe(0);
  });

  it('removes source pins on submission failure and still rejects arbitrary cross-workspace writes', async () => {
    await expect(scope(consumer, () => pins(form(shared), async () => { throw new Error('TEST_SUBMISSION_FAILED'); }))).rejects.toThrow('TEST_SUBMISSION_FAILED');
    expect(await scope(owner, () => prisma.workspaceActivity.count({ where: { kind: 'lora-use:' + shared.id } }))).toBe(0);
    await expect(scope(consumer, () => prisma.workspaceActivity.create({ data: { workspaceId: owner, kind: 'illegal', expiresAt: new Date(Date.now() + 1000) } }))).rejects.toThrow('cross-workspace');
  });

  it('launches two mock-provider shots with distinct poses and consumer-owned jobs', async () => {
    fakes.submit.mockImplementation(async () => {
      expect(context.getStore().workspaceId).toBe(consumer);
      expect(await scope(owner, () => prisma.workspaceActivity.count({ where: { kind: 'lora-use:' + shared.id } }))).toBe(1);
      return 'offline-' + randomUUID();
    });
    const run = await draft(2);
    const response = await requestLaunch(run.id), body = await response.json();
    expect(response.status).toBe(200); expect(body.success).toBe(true); expect(body.launched).toHaveLength(2);
    const jobs = await scope(consumer, () => prisma.job.findMany({ where: { id: { in: body.launched.map((r: any) => r.jobId) } } }));
    expect(jobs).toHaveLength(2); expect(jobs.every((j: any) => j.workspaceId === consumer && j.modelId === 'krea2-turbo')).toBe(true);
    const shots = await scope(consumer, () => prisma.studioSessionShot.findMany({ where: { runId: run.id }, include: { currentRevision: true } }));
    expect(new Set(shots.map((s: any) => s.currentRevision.poseId)).size).toBe(2);
    expect(await scope(owner, () => prisma.workspaceActivity.count({ where: { kind: 'lora-use:' + shared.id } }))).toBe(0);
    for (const call of localFetch.mock.calls) {
      expect(call[1].headers['x-workspace-id']).toBe(consumer);
      expect(call[1].body.get('image')).toBeNull();
    }
  });

  it('returns structured source-access errors without reaching the provider', async () => {
    const count = fakes.submit.mock.calls.length;
    const response = await generate(new Request('http://localhost/api/generate', { method: 'POST', headers: { 'x-workspace-id': consumer }, body: form(privateLora) }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('unavailable');
    expect(fakes.submit.mock.calls.length).toBe(count);
  });

  it('reports empty upstream failures as HTTP errors, not JSON parser exceptions', async () => {
    const run = await draft();
    localFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const response = await requestLaunch(run.id), body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toContain('HTTP 500');
    expect(body.error).not.toContain('JSON');
  });
});
