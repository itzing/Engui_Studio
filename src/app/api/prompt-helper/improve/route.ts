import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { getPromptHelperProvider } from '@/lib/promptHelper';

const settingsService = new SettingsService();
const userId = 'user-with-settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const negativePrompt = typeof body?.negativePrompt === 'string' ? body.negativePrompt : '';
    const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : '';
    const modelId = typeof body?.modelId === 'string' ? body.modelId : undefined;

    if (!instruction) {
      return NextResponse.json({ success: false, error: 'Instruction is required' }, { status: 400 });
    }

    const settingsResult = await settingsService.getSettings(userId);
    const provider = getPromptHelperProvider(settingsResult.settings.promptHelper || { provider: 'disabled' });
    const result = await provider.improve({ prompt, negativePrompt, instruction, modelId });

    return NextResponse.json({
      success: true,
      improvedPrompt: result.improvedPrompt,
      improvedNegativePrompt: result.improvedNegativePrompt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prompt Helper request failed';
    const status = /disabled|required/i.test(message) ? 400 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
