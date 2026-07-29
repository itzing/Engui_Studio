'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Info, Plus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  hasLoRAHelperContent,
  splitLoRAHelperNotes,
  type LoRAHelperProfile,
} from '@/lib/lora/helperProfiles';

type LoRAHelperPopoverProps = {
  profile?: LoRAHelperProfile | null;
  onApplyWeights?: (weights: { high: string; low: string }) => void;
  className?: string;
  dark?: boolean;
};

export function LoRAHelperPopover({
  profile,
  onApplyWeights,
  className,
  dark = false,
}: LoRAHelperPopoverProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [currentNotes, setCurrentNotes] = useState(profile?.notes ?? '');
  const [newPrompt, setNewPrompt] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const effectiveProfile = profile ? { ...profile, notes: currentNotes } : null;
  const noteGroups = useMemo(() => splitLoRAHelperNotes(currentNotes), [currentNotes]);
  const hasWeights = typeof profile?.recommendedHighWeight === 'number' || typeof profile?.recommendedLowWeight === 'number';
  const trimmedNewPrompt = newPrompt.trim();
  const appendedNotes = [currentNotes.trim(), trimmedNewPrompt].filter(Boolean).join('\n\n');
  const charsAfterAppend = appendedNotes.length;
  const canAppendPrompt = Boolean(trimmedNewPrompt) && charsAfterAppend <= 1000 && !isSaving;

  useEffect(() => {
    setCurrentNotes(profile?.notes ?? '');
    setNewPrompt('');
    setSaveError(null);
  }, [profile?.id, profile?.notes]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('touchstart', closeOnOutsideClick);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('touchstart', closeOnOutsideClick);
    };
  }, [open]);

  if (!hasLoRAHelperContent(effectiveProfile)) {
    return null;
  }

  const copyText = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setOpen(false);
      window.setTimeout(() => setCopiedIndex(null), 1200);
    } catch {
      setCopiedIndex(null);
    }
  };

  const savePrompt = async () => {
    if (!profile || !canAppendPrompt) return;

    const body = profile.scope === 'pair'
      ? {
          scope: 'pair',
          workspaceId: profile.workspaceId ?? null,
          highLoraId: profile.highLoraId,
          lowLoraId: profile.lowLoraId,
          notes: appendedNotes,
          recommendedHighWeight: profile.recommendedHighWeight ?? null,
          recommendedLowWeight: profile.recommendedLowWeight ?? null,
        }
      : {
          scope: 'single',
          workspaceId: profile.workspaceId ?? null,
          loraId: profile.loraId,
          notes: appendedNotes,
        };

    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch('/api/lora/helper-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'Failed to save prompt');
      }
      setCurrentNotes(data?.profile?.notes ?? appendedNotes);
      setNewPrompt('');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save prompt');
    } finally {
      setIsSaving(false);
    }
  };

  const panelClasses = dark
    ? 'border-white/10 bg-zinc-950 text-zinc-100 shadow-2xl'
    : 'border-slate-700/70 bg-slate-950 text-slate-100 shadow-2xl';
  const groupClasses = dark
    ? 'border-white/10 bg-white/[0.04] text-zinc-200 hover:border-cyan-400/40 hover:bg-cyan-500/10'
    : 'border-white/10 bg-white/[0.06] text-slate-100 hover:border-cyan-400/40 hover:bg-cyan-500/10';
  const mutedText = dark ? 'text-zinc-500' : 'text-slate-400';

  return (
    <span ref={rootRef} className={`relative inline-flex ${className ?? ''}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={dark ? 'h-8 w-8 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10 hover:text-white' : 'h-8 w-8'}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        aria-label="Open LoRA helper"
      >
        <Info className="h-4 w-4" />
      </Button>

      {open ? (
        <span
          className={`absolute right-0 top-10 z-[80] block max-h-[min(28rem,calc(100vh-2rem))] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-md border p-3 text-left md:fixed md:left-1/2 md:right-auto md:top-1/2 md:w-[min(26rem,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 ${panelClasses}`}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide">LoRA helper</span>

          {hasWeights && onApplyWeights ? (
            <button
              type="button"
              className={`mb-3 flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-xs ${groupClasses}`}
              onClick={() => onApplyWeights({
                high: String(profile?.recommendedHighWeight ?? ''),
                low: String(profile?.recommendedLowWeight ?? ''),
              })}
            >
              <span className="min-w-0">
                <span className="block font-medium">Apply recommended weights</span>
                <span className={`mt-0.5 block ${mutedText}`}>
                  HIGH {profile?.recommendedHighWeight ?? '-'} / LOW {profile?.recommendedLowWeight ?? '-'}
                </span>
              </span>
              <SlidersHorizontal className="h-4 w-4 shrink-0" />
            </button>
          ) : null}

          {noteGroups.length > 0 ? (
            <span className="block space-y-2">
              {noteGroups.map((group, index) => (
                <button
                  key={`${index}-${group.slice(0, 16)}`}
                  type="button"
                  className={`block w-full whitespace-pre-wrap rounded-md border px-3 py-2 text-left text-xs leading-relaxed ${groupClasses}`}
                  onClick={() => copyText(group, index)}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span>{group}</span>
                    {copiedIndex === index ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                    )}
                  </span>
                </button>
              ))}
            </span>
          ) : (
            <span className={`block text-xs ${mutedText}`}>No notes yet.</span>
          )}

          <span className="mt-3 block border-t border-white/10 pt-3">
            <label className={`mb-1 block text-xs font-medium ${mutedText}`} htmlFor={`lora-helper-new-prompt-${profile?.id}`}>
              Add prompt
            </label>
            <textarea
              id={`lora-helper-new-prompt-${profile?.id}`}
              value={newPrompt}
              maxLength={1000}
              onChange={(event) => {
                setNewPrompt(event.target.value);
                setSaveError(null);
              }}
              className="block h-20 w-full resize-none rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              placeholder="Paste trigger words or a sample prompt"
            />
            <span className="mt-2 flex items-center justify-between gap-2">
              <span className={`text-[11px] ${charsAfterAppend > 1000 ? 'text-red-400' : mutedText}`}>
                {charsAfterAppend}/1000
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-white/10 bg-white/[0.06] px-3 text-xs text-slate-100 hover:bg-cyan-500/10"
                disabled={!canAppendPrompt}
                onClick={savePrompt}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {isSaving ? 'Saving...' : 'Add'}
              </Button>
            </span>
            {saveError ? <span className="mt-2 block text-xs text-red-400">{saveError}</span> : null}
          </span>
        </span>
      ) : null}
    </span>
  );
}
