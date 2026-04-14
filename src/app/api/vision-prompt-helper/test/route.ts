import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { getVisionPromptHelperProvider, VisionPromptHelperSettings } from '@/lib/visionPromptHelper';

const settingsService = new SettingsService();
const userId = 'user-with-settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const savedSettings = await settingsService.getSettings(userId);

    const current = ((savedSettings.settings as any).visionPromptHelper || {}) as VisionPromptHelperSettings;
    const effectiveSettings: VisionPromptHelperSettings = {
      ...current,
      ...(body || {}),
      local: {
        ...(current.local || {}),
        ...(body?.local || {}),
      },
    };

    const provider = getVisionPromptHelperProvider(effectiveSettings);
    await provider.testConnection();

    return NextResponse.json({ success: true, message: 'Vision Prompt Helper connection successful' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vision Prompt Helper test failed';
    const status = /disabled|required/i.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
