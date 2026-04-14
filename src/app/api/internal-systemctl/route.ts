import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const ALLOWED_ACTIONS = new Set(['start', 'stop', 'restart', 'is-active']);
const ALLOWED_SERVICES = new Set([
  'prompt-helper-llama.service',
  'vision-prompt-helper-llama.service',
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : '';
    const serviceName = typeof body?.serviceName === 'string' ? body.serviceName : '';
    const runtimeDir = typeof body?.runtimeDir === 'string' ? body.runtimeDir : '/run/user/1001';

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ success: false, error: 'Unsupported systemctl action' }, { status: 400 });
    }

    if (!ALLOWED_SERVICES.has(serviceName)) {
      return NextResponse.json({ success: false, error: 'Unsupported service name' }, { status: 400 });
    }

    const { stdout, stderr } = await execFileAsync('systemctl', ['--user', action, serviceName], {
      env: {
        ...process.env,
        XDG_RUNTIME_DIR: runtimeDir,
      },
    });

    return NextResponse.json({ success: true, output: `${stdout || ''}${stderr || ''}`.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'systemctl command failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
