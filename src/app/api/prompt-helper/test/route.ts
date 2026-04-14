import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { getPromptHelperProvider, PromptHelperSettings } from '@/lib/promptHelper';
import { ensureHelperMode } from '@/lib/helperMode';

const settingsService = new SettingsService();
const userId = 'user-with-settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const savedSettings = await settingsService.getSettings(userId);

    const effectiveSettings: PromptHelperSettings = {
      ...(savedSettings.settings.promptHelper || {}),
      ...(body || {}),
      local: {
        ...(savedSettings.settings.promptHelper?.local || {}),
        ...(body?.local || {}),
      },
    };

    await ensureHelperMode('text');
    const provider = getPromptHelperProvider(effectiveSettings);
    await provider.testConnection();

    return NextResponse.json({
      success: true,
      message: 'Prompt Helper connection successful',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prompt Helper test failed';
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
