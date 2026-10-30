import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { ensureHelperMode } from '@/lib/helperMode';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { parseStrippedPrompt, STRIP_VIBE_INSTRUCTION } from '@/lib/vibes/stripPrompt';

const settingsService = new SettingsService();

async function POSTImpl(request: NextRequest) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim() || prompt.length > 40000) {
    return NextResponse.json({ success: false, error: 'Provide a prompt between 1 and 40,000 characters' }, { status: 400 });
  }
  try {
    const { settings } = await settingsService.getSettings('user-with-settings');
    const helper = settings.promptHelper;
    const local = helper?.local;
    if (helper?.provider !== 'local' || !local?.baseUrl?.trim() || !local?.model?.trim()) {
      return NextResponse.json({ success: false, error: 'Configure Prompt Helper in Settings to strip a vibe' }, { status: 400 });
    }
    await ensureHelperMode('text');
    const response = await fetch(`${local.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
      headers: { 'Content-Type': 'application/json', ...(local.apiKey ? { Authorization: `Bearer ${local.apiKey}` } : {}) },
      body: JSON.stringify({
        model: local.model,
        temperature: 0.1,
        max_tokens: 8000,
        stream: false,
        messages: [
          { role: 'system', content: STRIP_VIBE_INSTRUCTION },
          { role: 'user', content: JSON.stringify({ prompt }) },
        ],
      }),
    });
    if (!response.ok) throw new Error('Prompt Helper could not clean the prompt. Try again.');
    const data = await response.json();
    const choice = data?.choices?.[0];
    if (choice?.finish_reason === 'length') throw new Error('Cleanup was truncated. Your prompt was kept.');
    const content = choice?.message?.content;
    const text = Array.isArray(content) ? content.map((part: { text?: string }) => part.text || '').join('') : content;
    // Reasoning text is not a valid substitute for the assistant result.
    return NextResponse.json({ success: true, prompt: parseStrippedPrompt(text, prompt) });
  } catch (error) {
    const message = error instanceof Error && error.name !== 'AbortError' && error.name !== 'TimeoutError'
      ? error.message : 'Vibe cleanup timed out or was cancelled. Your prompt was kept.';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}

export const POST = withWorkspaceRoute(POSTImpl, 'content');
