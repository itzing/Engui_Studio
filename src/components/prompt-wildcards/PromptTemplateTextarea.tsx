'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PromptWildcardSummary } from '@/lib/prompt-wildcards/types';

type PromptTemplateTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  workspaceId?: string | null;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  testId?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

type ActiveQuery = {
  start: number;
  end: number;
  query: string;
};

type PromptToken = {
  key: string;
  variant: string;
  start: number;
  end: number;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed');
  }
  return data as T;
}

function getActiveQuery(value: string, cursor: number): ActiveQuery | null {
  const beforeCursor = value.slice(0, cursor);
  const openIndex = beforeCursor.lastIndexOf('{');
  if (openIndex < 0) return null;

  const afterOpen = beforeCursor.slice(openIndex + 1);
  if (afterOpen.includes('}') || afterOpen.includes('\n') || afterOpen.includes(':')) return null;
  if (!/^[A-Za-z0-9_]*$/.test(afterOpen)) return null;

  return {
    start: openIndex,
    end: cursor,
    query: afterOpen,
  };
}

function findPromptTokens(value: string, wildcards: PromptWildcardSummary[]): PromptToken[] {
  const knownKeys = new Set(wildcards.map((wildcard) => wildcard.key));
  const tokens: PromptToken[] = [];
  const matcher = /\{([A-Za-z][A-Za-z0-9_]*)(?::([^{}\n]+))?\}/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(value)) !== null) {
    const key = match[1];
    if (!knownKeys.has(key)) continue;
    tokens.push({
      key,
      variant: (match[2] || '').trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return tokens;
}

export default function PromptTemplateTextarea({
  value,
  onChange,
  workspaceId,
  className,
  placeholder,
  disabled,
  autoFocus,
  testId,
  onKeyDown,
}: PromptTemplateTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [wildcards, setWildcards] = useState<PromptWildcardSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeQuery, setActiveQuery] = useState<ActiveQuery | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [activeToken, setActiveToken] = useState<PromptToken | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setWildcards([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/prompt-wildcards?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: 'no-store' })
      .then((response) => readJson<{ success: true; wildcards: PromptWildcardSummary[] }>(response))
      .then((data) => {
        if (!cancelled) setWildcards(data.wildcards);
      })
      .catch(() => {
        if (!cancelled) setWildcards([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!autoFocus) return;
    const timeout = window.setTimeout(() => {
      const textarea = textareaRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
      setActiveQuery(getActiveQuery(textarea?.value || '', textarea?.selectionStart || 0));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [autoFocus]);

  const matchingWildcards = useMemo(() => {
    const query = activeQuery?.query.toLowerCase() || '';
    if (!activeQuery) return [];
    return wildcards
      .filter((wildcard) => {
        const searchText = `${wildcard.key} ${wildcard.name} ${wildcard.value}`.toLowerCase();
        return searchText.includes(query);
      })
      .slice(0, 8);
  }, [activeQuery, wildcards]);

  const promptTokens = useMemo(() => findPromptTokens(value, wildcards), [value, wildcards]);
  const activeTokenWildcard = useMemo(
    () => wildcards.find((wildcard) => wildcard.key === activeToken?.key) || null,
    [activeToken, wildcards],
  );

  useEffect(() => {
    setHighlightedIndex(0);
  }, [activeQuery?.query]);

  const updateActiveQueryFromTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) {
      setActiveQuery(null);
      return;
    }
    setActiveQuery(getActiveQuery(textarea.value, textarea.selectionStart));
  };

  const replaceRange = (start: number, end: number, replacement: string) => {
    const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    onChange(nextValue);
    window.setTimeout(() => {
      const textarea = textareaRef.current;
      const cursor = start + replacement.length;
      textarea?.focus();
      textarea?.setSelectionRange(cursor, cursor);
      setActiveQuery(null);
    }, 0);
  };

  const insertWildcard = (wildcard: PromptWildcardSummary) => {
    if (!activeQuery) return;
    let end = activeQuery.end;
    if (value[end] === '}') end += 1;
    replaceRange(activeQuery.start, end, `{${wildcard.key}}`);
  };

  const setTokenVariant = (variant: string) => {
    if (!activeToken) return;
    const replacement = variant ? `{${activeToken.key}:${variant}}` : `{${activeToken.key}}`;
    replaceRange(activeToken.start, activeToken.end, replacement);
    setActiveToken(null);
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (activeQuery && matchingWildcards.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((current) => (current + 1) % matchingWildcards.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((current) => (current - 1 + matchingWildcards.length) % matchingWildcards.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertWildcard(matchingWildcards[highlightedIndex] || matchingWildcards[0]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setActiveQuery(null);
        return;
      }
    }

    onKeyDown?.(event);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            window.setTimeout(updateActiveQueryFromTextarea, 0);
          }}
          onClick={updateActiveQueryFromTextarea}
          onKeyDown={handleTextareaKeyDown}
          onKeyUp={updateActiveQueryFromTextarea}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          data-testid={testId}
        />
        {activeQuery && !disabled ? (
          <div className="absolute left-2 right-2 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg" data-testid="prompt-template-autocomplete">
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading templates
              </div>
            ) : matchingWildcards.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No templates found</div>
            ) : matchingWildcards.map((wildcard, index) => (
              <button
                key={wildcard.id}
                type="button"
                className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm ${index === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertWildcard(wildcard)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{wildcard.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{`{${wildcard.key}}`}</span>
                </span>
                {wildcard.variants.length > 0 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{wildcard.variants.length} variants</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {promptTokens.length > 0 ? (
        <div className="flex flex-wrap gap-2" data-testid="prompt-template-token-list">
          {promptTokens.map((token) => {
            const wildcard = wildcards.find((entry) => entry.key === token.key);
            const hasVariants = !!wildcard && wildcard.variants.length > 0;
            return (
              <button
                key={`${token.start}-${token.end}-${token.key}`}
                type="button"
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-default disabled:opacity-60"
                onClick={() => {
                  if (hasVariants) setActiveToken(token);
                }}
                disabled={!hasVariants || disabled}
                title={hasVariants ? 'Choose variant' : 'No variants'}
              >
                <span className="truncate">{token.variant ? `{${token.key}: ${token.variant}}` : `{${token.key}}`}</span>
                {hasVariants ? <ChevronDown className="h-3 w-3 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <Dialog open={!!activeToken} onOpenChange={(open) => !open && setActiveToken(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4 text-left">
            <DialogTitle className="text-base">{activeTokenWildcard?.name || 'Template variants'}</DialogTitle>
            <DialogDescription className="sr-only">Choose a fixed variant or keep seeded random selection.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-3">
            <button
              type="button"
              className={`mb-2 w-full rounded-md border px-3 py-2 text-left text-sm ${!activeToken?.variant ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-accent/60'}`}
              onClick={() => setTokenVariant('')}
            >
              Random variant
            </button>
            <div className="space-y-1">
              {(activeTokenWildcard?.variants || []).map((variant) => (
                <button
                  key={variant}
                  type="button"
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${variant === activeToken?.variant ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-accent/60'}`}
                  onClick={() => setTokenVariant(variant)}
                >
                  {variant}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
