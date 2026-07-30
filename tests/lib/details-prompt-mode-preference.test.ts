/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DETAILS_PROMPT_MODE_STORAGE_KEY,
  getAvailableDetailsPromptMode,
  readDetailsPromptModePreference,
  writeDetailsPromptModePreference,
  type DetailsPromptModeOption,
} from '@/lib/detailsPromptModePreference';

const videoOptions: DetailsPromptModeOption[] = [
  { mode: 'original', label: 'Video' },
  { mode: 'resolved', label: 'Resolved video' },
  { mode: 'sourceImage', label: 'Source image' },
  { mode: 'sourceImageResolved', label: 'Resolved source' },
];

describe('details prompt mode preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists a selected prompt mode', () => {
    writeDetailsPromptModePreference('resolved');

    expect(window.localStorage.getItem(DETAILS_PROMPT_MODE_STORAGE_KEY)).toBe('resolved');
    expect(readDetailsPromptModePreference()).toBe('resolved');
  });

  it('falls back to the first available mode when the saved mode is unavailable', () => {
    expect(getAvailableDetailsPromptMode('sourceImageResolved', [
      { mode: 'original', label: 'Original' },
      { mode: 'resolved', label: 'Resolved' },
    ])).toBe('original');
  });

  it('keeps the saved mode when the next item supports it', () => {
    expect(getAvailableDetailsPromptMode('resolved', videoOptions)).toBe('resolved');
    expect(getAvailableDetailsPromptMode('sourceImage', videoOptions)).toBe('sourceImage');
  });
});
