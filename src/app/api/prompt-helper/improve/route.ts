import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { getPromptHelperProvider, PromptHelperProviderError } from '@/lib/promptHelper';
import type { PromptHelperProfile } from '@/lib/promptHelper';
import { ensureHelperMode } from '@/lib/helperMode';

const settingsService = new SettingsService();
const userId = 'user-with-settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const negativePrompt = typeof body?.negativePrompt === 'string' ? body.negativePrompt : '';
    const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : '';
    const modelId = typeof body?.modelId === 'string' ? body.modelId : undefined;
    const helperProfile: PromptHelperProfile = body?.helperProfile === 'wan22-video' ? 'wan22-video' : 'default';

    if (!instruction) {
      return NextResponse.json({ success: false, error: 'Instruction is required' }, { status: 400 });
    }

    const settingsResult = await settingsService.getSettings(userId);
    await ensureHelperMode('text');
    const provider = getPromptHelperProvider(settingsResult.settings.promptHelper || { provider: 'disabled' });
    const result = await provider.improve({ prompt, negativePrompt, instruction, modelId, helperProfile });

    return new NextResponse(result.improvedPrompt, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prompt Helper request failed';
    const isProviderError = error instanceof PromptHelperProviderError;
    const isInvalidJson = isProviderError && error.code === 'invalid_json';
    const status = /disabled|required/i.test(message) ? 400 : isInvalidJson ? 422 : 500;

    return new NextResponse(isInvalidJson ? 'Prompt Helper returned invalid JSON. No retry was attempted.' : message, {
      status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
