/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InlineConfirmDeleteButton } from '@/components/jobs/InlineConfirmDeleteButton';

describe('InlineConfirmDeleteButton', () => {
  it('arms on the first press and confirms on the second press without browser confirm', () => {
    const confirm = vi.fn();
    const browserConfirm = vi.spyOn(window, 'confirm');

    render(React.createElement(InlineConfirmDeleteButton, {
      onConfirm: confirm,
      className: 'delete',
      confirmClassName: 'confirm',
      label: 'Delete job',
      confirmLabel: 'Confirm delete',
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete job' }));

    expect(confirm).not.toHaveBeenCalled();
    expect(browserConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm delete job' }).textContent).toContain('Confirm delete');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete job' }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(browserConfirm).not.toHaveBeenCalled();
  });
});
