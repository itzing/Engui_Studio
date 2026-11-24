'use client';
import { workspaceFetch as fetch } from '@/lib/workspaces/client';
import { useWorkspaceFetch } from '@/lib/workspaces/useWorkspaceFetch';


import CharacterPromptTools, { type PromptCharacter } from './CharacterPromptTools';
import { characterReferenceToken } from '@/lib/character-references/tokens';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PromptWildcardSummary } from '@/lib/prompt-wildcards/types';
import {
  clampSelectionPosition,
  normalizePromptWildcardSelections,
  parsePromptWildcardIndexList,
  serializePromptWildcardIndexList,
  type PromptWildcardSelectionMap,
  type PromptWildcardSelectionMode,
} from '@/lib/prompt-wildcards/selections';

type PromptTemplateTextareaProps = {
  enableCharacterReferences?: boolean;
  previewSeed?: number | string;
  randomizeSeed?: boolean;
  selectedVibeId?: string;
  value: string;
  onChange: (value: string) => void;
  workspaceId?: string | null;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  testId?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  promptWildcardSelections?: PromptWildcardSelectionMap;
  onPromptWildcardSelectionsChange?: (selections: PromptWildcardSelectionMap) => void;
};

type ActiveQuery = {
  start: number;
  end: number;
  query: string;
};

type PromptToken = {
  key: string;
  variant: string;
  variantIndices: number[] | null;
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

function getActiveQuery(value: string, cursor: number, charactersEnabled = false): ActiveQuery | null {
  const beforeCursor = value.slice(0, cursor);
  const openIndex = beforeCursor.lastIndexOf('{');
  if (openIndex < 0) return null;

  const afterOpen = beforeCursor.slice(openIndex + 1);
  if (afterOpen.includes('}') || afterOpen.includes('\n')) return null;
  if (!charactersEnabled && !/^[A-Za-z0-9_]*$/.test(afterOpen)) return null;
  if (charactersEnabled && afterOpen.includes(':') && !afterOpen.startsWith('character:')) return null;

  return {
    start: openIndex,
    end: cursor,
    query: afterOpen,
  };
}

function findPromptTokens(value: string, wildcards: PromptWildcardSummary[], charactersEnabled = false): PromptToken[] {
  const knownKeys = new Set(wildcards.map((wildcard) => wildcard.key));
  const tokens: PromptToken[] = [];
  const matcher = /\{([A-Za-z][A-Za-z0-9_]*)(?::([^{}\n]+))?\}/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(value)) !== null) {
    const key = match[1];
    if (charactersEnabled && key === 'character' && match[2]) continue;
    if (!knownKeys.has(key)) continue;
    tokens.push({
      key,
      variant: (match[2] || '').trim(),
      variantIndices: parsePromptWildcardIndexList(match[2] || ''),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return tokens;
}

export default function PromptTemplateTextarea({
  enableCharacterReferences = false, previewSeed, randomizeSeed, selectedVibeId,
  value,
  onChange,
  workspaceId,
  className,
  placeholder,
  disabled,
  autoFocus,
  testId,
  onKeyDown,
  promptWildcardSelections,
  onPromptWildcardSelectionsChange,
}: PromptTemplateTextareaProps) {
  const fetch = useWorkspaceFetch();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [characters, setCharacters] = useState<PromptCharacter[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [charactersError, setCharactersError] = useState<string | null>(null);
  const [includeOutfit, setIncludeOutfit] = useState(false);
  const insertionRange = useRef({ start: 0, end: 0 });
  const [wildcards, setWildcards] = useState<PromptWildcardSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeQuery, setActiveQuery] = useState<ActiveQuery | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [activeToken, setActiveToken] = useState<PromptToken | null>(null);

  useEffect(() => {
    setCharacters([]); setCharactersError(null); setActiveQuery(null);
    if (!enableCharacterReferences || !workspaceId) { setCharactersLoading(false); return; }
    let cancelled = false;
    setCharactersLoading(true);
    fetch(`/api/characters?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: 'no-store' })
      .then(response => readJson<{ success: true; characters: PromptCharacter[] }>(response))
      .then(data => { if (!cancelled) setCharacters(data.characters || []); })
      .catch(error => { if (!cancelled) setCharactersError(error instanceof Error ? error.message : 'Could not load characters.'); })
      .finally(() => { if (!cancelled) setCharactersLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId, enableCharacterReferences]);

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
      setActiveQuery(getActiveQuery(textarea?.value || '', textarea?.selectionStart || 0, enableCharacterReferences));
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

  const matchingCharacters = useMemo(() => {
    if (!enableCharacterReferences || !activeQuery) return [];
    const query = activeQuery.query.replace(/^character:/, '').toLocaleLowerCase();
    return characters.filter(character => character.name.toLocaleLowerCase().includes(query) || character.id.startsWith(query)).slice(0, 8);
  }, [characters, activeQuery, enableCharacterReferences]);
  const suggestionCount = matchingWildcards.length + matchingCharacters.length;

  const promptTokens = useMemo(() => findPromptTokens(value, wildcards, enableCharacterReferences), [value, wildcards, enableCharacterReferences]);
  const activeTokenWildcard = useMemo(
    () => wildcards.find((wildcard) => wildcard.key === activeToken?.key) || null,
    [activeToken, wildcards],
  );
  const normalizedSelections = useMemo(
    () => normalizePromptWildcardSelections(promptWildcardSelections),
    [promptWildcardSelections],
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
    setActiveQuery(getActiveQuery(textarea.value, textarea.selectionStart, enableCharacterReferences));
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

  const insertCharacter = (character: PromptCharacter) => {
    const textarea = textareaRef.current;
    const start = activeQuery?.start ?? insertionRange.current.start;
    let end = activeQuery?.end ?? insertionRange.current.end;
    if (activeQuery && value[end] === '}') end += 1;
    replaceRange(start, end, characterReferenceToken(character.id, includeOutfit));
  };

  const updateTokenSelection = (
    token: PromptToken,
    indices: number[],
    mode: PromptWildcardSelectionMode = normalizedSelections[token.key]?.mode || 'random',
    startIndex = normalizedSelections[token.key]?.startIndex || 0,
  ) => {
    const wildcard = wildcards.find((entry) => entry.key === token.key);
    if (!wildcard || wildcard.variants.length === 0) return;

    const allIndices = wildcard.variants.map((_variant, index) => index);
    const sanitizedIndices = Array.from(new Set(indices))
      .filter((index) => Number.isInteger(index) && index >= 0 && index < wildcard.variants.length)
      .sort((a, b) => a - b);
    const nextIndices = sanitizedIndices.length > 0 ? sanitizedIndices : allIndices;
    const isAllSelected = nextIndices.length === allIndices.length;
    const nextMode = isAllSelected && mode !== 'sequential' ? 'random' : mode;
    const maxPosition = nextIndices.length - 1;
    const nextStartIndex = clampSelectionPosition(startIndex, maxPosition);
    const replacement = isAllSelected && nextMode === 'random'
      ? `{${token.key}}`
      : `{${token.key}:${serializePromptWildcardIndexList(nextIndices)}}`;

    onPromptWildcardSelectionsChange?.({
      ...normalizedSelections,
      [token.key]: {
        indices: nextIndices,
        mode: nextMode,
        startIndex: nextStartIndex,
        cursor: nextStartIndex,
      },
    });
    replaceRange(token.start, token.end, replacement);
    setActiveToken({
      ...token,
      variant: replacement.slice(token.key.length + 2, -1),
      variantIndices: isAllSelected && nextMode === 'random' ? null : nextIndices,
      end: token.start + replacement.length,
    });
  };

  const setTokenMode = (mode: PromptWildcardSelectionMode) => {
    if (!activeToken) return;
    const wildcard = activeTokenWildcard;
    if (!wildcard) return;
    const selectedIndices = activeToken.variantIndices || wildcard.variants.map((_variant, index) => index);
    updateTokenSelection(activeToken, selectedIndices, mode, normalizedSelections[activeToken.key]?.startIndex || 0);
  };

  const setTokenStartIndex = (value: string) => {
    if (!activeToken) return;
    const wildcard = activeTokenWildcard;
    if (!wildcard) return;
    const selectedIndices = activeToken.variantIndices || wildcard.variants.map((_variant, index) => index);
    updateTokenSelection(activeToken, selectedIndices, 'sequential', Number.parseInt(value, 10));
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (activeQuery && suggestionCount > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((current) => (current + 1) % suggestionCount);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((current) => (current - 1 + suggestionCount) % suggestionCount);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        if (highlightedIndex < matchingWildcards.length) insertWildcard(matchingWildcards[highlightedIndex]);
        else insertCharacter(matchingCharacters[highlightedIndex - matchingWildcards.length] || matchingCharacters[0]);
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
          onSelect={(event) => { insertionRange.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }}
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
            {enableCharacterReferences ? <label className="flex items-center gap-2 px-3 py-2 text-xs"><input type="checkbox" checked={includeOutfit} onChange={event => setIncludeOutfit(event.target.checked)} />Include outfit</label> : null}
            {isLoading || charactersLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading templates
              </div>
            ) : suggestionCount === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">{charactersError || 'No templates or characters found'}</div>
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
            {matchingCharacters.map((character, index) => <button key={character.id} type="button"
              className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm ${index + matchingWildcards.length === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
              onMouseDown={event => event.preventDefault()} onClick={() => insertCharacter(character)}>
              <span className="truncate font-medium">{character.name}</span><span className="shrink-0 text-xs text-muted-foreground">Character</span>
            </button>)}
          </div>
        ) : null}
      </div>

      {enableCharacterReferences ? <CharacterPromptTools characters={characters} loading={charactersLoading} error={charactersError}
        includeOutfit={includeOutfit} setIncludeOutfit={setIncludeOutfit} insertCharacter={insertCharacter}
        prompt={value} workspaceId={workspaceId} disabled={disabled} seed={previewSeed} randomizeSeed={randomizeSeed}
        selectedVibeId={selectedVibeId} selections={promptWildcardSelections} /> : null}

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
                <span className="truncate">{token.variantIndices ? `{${token.key}: ${token.variantIndices.join(',')}}` : token.variant ? `{${token.key}: ${token.variant}}` : `{${token.key}}`}</span>
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
            <DialogDescription className="sr-only">Choose variants and wildcard resolution order.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-3">
            {activeToken && activeTokenWildcard ? (() => {
              const allIndices = activeTokenWildcard.variants.map((_variant, index) => index);
              const selectedIndices = activeToken.variantIndices || allIndices;
              const selection = normalizedSelections[activeToken.key];
              const mode = selection?.mode || 'random';
              const startIndex = clampSelectionPosition(selection?.startIndex, selectedIndices.length - 1);
              const allSelected = selectedIndices.length === allIndices.length;
              return (
                <div className="mb-3 space-y-3 rounded-md border border-border bg-muted/20 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`rounded-md border px-3 py-2 text-sm font-medium ${mode === 'random' ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-accent/60'}`}
                      onClick={() => setTokenMode('random')}
                    >
                      Random
                    </button>
                    <button
                      type="button"
                      className={`rounded-md border px-3 py-2 text-sm font-medium ${mode === 'sequential' ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-accent/60'}`}
                      onClick={() => setTokenMode('sequential')}
                    >
                      Sequential
                    </button>
                  </div>
                  <label className="block space-y-1 text-xs font-medium text-muted-foreground">
                    <span>Start index</span>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, selectedIndices.length - 1)}
                      value={startIndex}
                      disabled={mode !== 'sequential'}
                      onChange={(event) => setTokenStartIndex(event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50"
                    />
                  </label>
                  {!allSelected ? (
                    <button
                      type="button"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:bg-accent/60"
                      onClick={() => updateTokenSelection(activeToken, allIndices, mode, startIndex)}
                    >
                      Select all
                    </button>
                  ) : null}
                </div>
              );
            })() : null}
            <div className="space-y-1">
              {(activeTokenWildcard?.variants || []).map((variant, index) => {
                const selectedIndices = activeToken?.variantIndices || activeTokenWildcard?.variants.map((_value, nextIndex) => nextIndex) || [];
                const selectedSet = new Set(selectedIndices);
                const isSelected = selectedSet.has(index);
                return (
                <button
                  key={`${index}-${variant}`}
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm ${isSelected ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-accent/60'}`}
                  onClick={() => {
                    if (!activeToken || !activeTokenWildcard) return;
                    const allIndices = activeTokenWildcard.variants.map((_value, nextIndex) => nextIndex);
                    const allSelected = selectedIndices.length === allIndices.length;
                    const nextIndices = isSelected
                      ? (allSelected ? [index] : selectedIndices.filter((selectedIndex) => selectedIndex !== index))
                      : [...selectedIndices, index];
                    updateTokenSelection(activeToken, nextIndices, normalizedSelections[activeToken.key]?.mode || 'random', normalizedSelections[activeToken.key]?.startIndex || 0);
                  }}
                >
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}>
                    {isSelected ? '✓' : ''}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] text-muted-foreground">#{index}</span>
                    <span className="block break-words">{variant}</span>
                  </span>
                </button>
              );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
