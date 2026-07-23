import { describe, expect, it } from 'vitest';
import { getViewportFormFactor } from '@/lib/mobile/viewportFormFactor';

describe('getViewportFormFactor', () => {
  it('keeps phone portrait on the normal mobile branch', () => {
    expect(getViewportFormFactor({ width: 390, height: 844, touch: true })).toBe('phone-portrait');
  });

  it('classifies phone landscape as a blocked phone state', () => {
    expect(getViewportFormFactor({ width: 844, height: 390, touch: true })).toBe('phone-landscape');
  });

  it('classifies iPad portrait as tablet portrait', () => {
    expect(getViewportFormFactor({ width: 768, height: 1024, touch: true })).toBe('tablet-portrait');
  });

  it('classifies iPad landscape as tablet landscape', () => {
    expect(getViewportFormFactor({ width: 1024, height: 768, touch: true })).toBe('tablet-landscape');
    expect(getViewportFormFactor({ width: 1180, height: 820, touch: true })).toBe('tablet-landscape');
    expect(getViewportFormFactor({ width: 1366, height: 1024, touch: true })).toBe('tablet-landscape');
  });

  it('does not treat a wide short phone viewport as tablet', () => {
    expect(getViewportFormFactor({ width: 932, height: 430, touch: true })).toBe('phone-landscape');
  });

  it('does not treat a non-touch desktop viewport as tablet', () => {
    expect(getViewportFormFactor({ width: 1024, height: 768, touch: false })).toBe('phone-landscape');
  });
});
