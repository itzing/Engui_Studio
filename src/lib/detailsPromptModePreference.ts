export type DetailsPromptMode = 'original' | 'resolved' | 'sourceImage' | 'sourceImageResolved';

export type DetailsPromptModeOption = {
  mode: DetailsPromptMode;
  label: string;
};

export const DETAILS_PROMPT_MODE_STORAGE_KEY = 'engui.details.promptMode';

const detailsPromptModes: DetailsPromptMode[] = ['original', 'resolved', 'sourceImage', 'sourceImageResolved'];

function isDetailsPromptMode(value: unknown): value is DetailsPromptMode {
  return typeof value === 'string' && detailsPromptModes.includes(value as DetailsPromptMode);
}

export function readDetailsPromptModePreference(): DetailsPromptMode {
  if (typeof window === 'undefined') return 'original';

  try {
    const stored = window.localStorage.getItem(DETAILS_PROMPT_MODE_STORAGE_KEY);
    return isDetailsPromptMode(stored) ? stored : 'original';
  } catch {
    return 'original';
  }
}

export function writeDetailsPromptModePreference(mode: DetailsPromptMode) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(DETAILS_PROMPT_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors so private browsing modes do not break details panels.
  }
}

export function getAvailableDetailsPromptMode(
  preferredMode: DetailsPromptMode,
  options: DetailsPromptModeOption[],
): DetailsPromptMode {
  if (options.some((option) => option.mode === preferredMode)) return preferredMode;
  return options[0]?.mode || 'original';
}
