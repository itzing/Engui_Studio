import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { getCharacterAssistantProvider } from '@/lib/characterAssistant';
import { ensureHelperMode } from '@/lib/helperMode';

const settingsService = new SettingsService();
const userId = 'user-with-settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : '';
    const editableTraits = body?.editableTraits && typeof body.editableTraits === 'object' && !Array.isArray(body.editableTraits)
      ? Object.fromEntries(
          Object.entries(body.editableTraits as Record<string, unknown>)
            .filter(([key, value]) => typeof key === 'string' && typeof value === 'string' && key.trim())
            .map(([key, value]) => [key.trim(), (value as string).trim()])
        )
      : {};

    if (!instruction) {
      return NextResponse.json({ success: false, error: 'Instruction is required' }, { status: 400 });
    }

    const settingsResult = await settingsService.getSettings(userId);
    await ensureHelperMode('text');
    const provider = getCharacterAssistantProvider(settingsResult.settings.promptHelper || { provider: 'disabled' });
    const result = await provider.apply({ instruction, editableTraits });

    return NextResponse.json({
      success: true,
      summary: result.summary,
      action: result.action,
      changes: result.changes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Character Assistant request failed';
    const status = /disabled|required/i.test(message) ? 400 : 500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
