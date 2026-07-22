'use client';

import React, { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';

type InlineConfirmDeleteButtonProps = {
  onConfirm: () => void | Promise<void>;
  className: string;
  confirmClassName?: string;
  disabled?: boolean;
  label?: string;
  confirmLabel?: string;
  title?: string;
  confirmTitle?: string;
  ariaLabel?: string;
  confirmAriaLabel?: string;
  iconClassName?: string;
  stopPropagation?: boolean;
  resetKey?: string | null;
};

export function InlineConfirmDeleteButton({
  onConfirm,
  className,
  confirmClassName,
  disabled = false,
  label,
  confirmLabel = 'Confirm',
  title = 'Delete',
  confirmTitle = 'Confirm delete',
  ariaLabel = 'Delete job',
  confirmAriaLabel = 'Confirm delete job',
  iconClassName = 'h-4 w-4',
  stopPropagation = false,
  resetKey = null,
}: InlineConfirmDeleteButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    setIsConfirming(false);
  }, [resetKey]);

  useEffect(() => {
    if (!isConfirming) return;
    const timeout = window.setTimeout(() => setIsConfirming(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [isConfirming]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        if (disabled) return;
        if (!isConfirming) {
          setIsConfirming(true);
          return;
        }
        setIsConfirming(false);
        void onConfirm();
      }}
      className={isConfirming ? (confirmClassName || className) : className}
      title={isConfirming ? confirmTitle : title}
      aria-label={isConfirming ? confirmAriaLabel : ariaLabel}
      data-confirming-delete={isConfirming ? 'true' : 'false'}
    >
      {isConfirming ? <Check className={iconClassName} /> : <Trash2 className={iconClassName} />}
      {label ? <span>{isConfirming ? confirmLabel : label}</span> : null}
    </button>
  );
}
