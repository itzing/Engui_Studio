import type { PromptConstructorReuseDraft } from '@/lib/prompt-constructor/types';

const STORAGE_KEY = 'engui:prompt-constructor:reuse-draft';

export function persistPromptConstructorReuseDraft(payload: PromptConstructorReuseDraft) {
  if (typeof window === 'undefined') return false;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return true;
}

export function consumePromptConstructorReuseDraft(): PromptConstructorReuseDraft | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  window.localStorage.removeItem(STORAGE_KEY);

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.snapshot?.templateId === 'scene_template_v2') {
      return parsed as PromptConstructorReuseDraft;
    }
  } catch (error) {
    console.warn('Failed to restore Prompt Constructor reuse draft:', error);
  }

  return null;
}
