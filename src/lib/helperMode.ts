import { promises as fs } from 'fs';

const LOCK_DIR = '/tmp/engui-helper-mode.lock';
const USER_RUNTIME_DIR = '/run/user/1001';
const TEXT_SERVICE = {
  name: 'prompt-helper-llama.service',
  healthUrl: 'http://127.0.0.1:8012/health',
};
const VISION_SERVICE = {
  name: 'vision-prompt-helper-llama.service',
  healthUrl: 'http://127.0.0.1:8013/health',
};

type HelperMode = 'text' | 'vision';
type ServiceDef = typeof TEXT_SERVICE | typeof VISION_SERVICE;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const timeoutAt = Date.now() + 90_000;

  while (true) {
    try {
      await fs.mkdir(LOCK_DIR);
      break;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
      if (Date.now() > timeoutAt) throw new Error('Timed out waiting for helper mode switch lock');
      await sleep(250);
    }
  }

  try {
    return await fn();
  } finally {
    await fs.rm(LOCK_DIR, { recursive: true, force: true });
  }
}

async function runUserSystemctl(action: 'start' | 'stop' | 'restart' | 'is-active', serviceName: string): Promise<string> {
  const response = await fetch('http://127.0.0.1:3010/api/internal-systemctl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      serviceName,
      runtimeDir: USER_RUNTIME_DIR,
    }),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : `systemctl ${action} failed for ${serviceName}`);
  }

  return typeof data.output === 'string' ? data.output : '';
}

async function isActive(service: ServiceDef): Promise<boolean> {
  try {
    const output = await runUserSystemctl('is-active', service.name);
    return output.trim() === 'active';
  } catch {
    return false;
  }
}

async function waitForHealth(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'unknown error';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
      lastError = `health returned ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000);
  }

  throw new Error(`Timed out waiting for helper health at ${url}: ${lastError}`);
}

async function ensureServiceActive(service: ServiceDef) {
  if (!(await isActive(service))) {
    await runUserSystemctl('start', service.name);
  }
  await waitForHealth(service.healthUrl);
}

async function ensureServiceStopped(service: ServiceDef) {
  if (await isActive(service)) {
    await runUserSystemctl('stop', service.name);
    await sleep(500);
  }
}

export async function ensureHelperMode(mode: HelperMode): Promise<void> {
  await withLock(async () => {
    const target = mode === 'text' ? TEXT_SERVICE : VISION_SERVICE;
    const other = mode === 'text' ? VISION_SERVICE : TEXT_SERVICE;

    await ensureServiceStopped(other);

    if (await isActive(target)) {
      await waitForHealth(target.healthUrl, 15_000);
      return;
    }

    await ensureServiceActive(target);
  });
}
