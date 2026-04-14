import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { getVisionPromptHelperProvider, VisionPromptHelperProviderError } from '@/lib/visionPromptHelper';

const settingsService = new SettingsService();
const userId = 'user-with-settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl : '';
    const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : '';
    const instruction = typeof body?.instruction === 'string' ? body.instruction : '';
    const modelId = typeof body?.modelId === 'string' ? body.modelId : undefined;

    if (!imageUrl && !imageDataUrl) {
      return NextResponse.json({ success: false, error: 'imageUrl or imageDataUrl is required' }, { status: 400 });
    }

    const settingsResult = await settingsService.getSettings(userId);
    const provider = getVisionPromptHelperProvider((settingsResult.settings as any).visionPromptHelper || { provider: 'disabled' });
    const result = await provider.extractPrompt({ imageUrl, imageDataUrl, instruction, modelId });

    return NextResponse.json({ success: true, prompt: result.prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vision Prompt Helper request failed';
    const status = /disabled|required/i.test(message) ? 400 : 500;
    const debug = error instanceof VisionPromptHelperProviderError ? error.debug : undefined;

    return NextResponse.json({ success: false, error: message, debug }, { status });
  }
}
