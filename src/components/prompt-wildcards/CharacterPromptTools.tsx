"use client";
import React, { useEffect, useRef, useState } from 'react';
import { workspaceFetch } from '@/lib/workspaces/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type PromptCharacter = { id: string; name: string };
export default function CharacterPromptTools({
  characters, loading, error, includeOutfit, setIncludeOutfit, insertCharacter,
  prompt, workspaceId, disabled, seed, randomizeSeed, selectedVibeId, selections,
}: {
  characters: PromptCharacter[]; loading: boolean; error: string | null;
  includeOutfit: boolean; setIncludeOutfit: (value: boolean) => void;
  insertCharacter: (character: PromptCharacter) => void;
  prompt: string; workspaceId?: string | null; disabled?: boolean;
  seed?: number | string; randomizeSeed?: boolean; selectedVibeId?: string; selections?: unknown;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const invalidate = () => { request.current?.abort(); request.current = null; setPreview(null); setPreviewError(null); setBusy(false); };
  useEffect(() => { invalidate(); setPreviewOpen(false); }, [prompt, workspaceId, seed, selectedVibeId, JSON.stringify(selections)]);
  useEffect(() => { setPickerOpen(false); setQuery(''); }, [workspaceId]);
  useEffect(() => () => request.current?.abort(), []);
  const openPreview = async () => {
    invalidate();
    const controller = new AbortController(); request.current = controller;
    setPreviewOpen(true); setBusy(true);
    try {
      const response = await workspaceFetch('/api/create/prompt-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ workspaceId, prompt, seed: seed ?? 0, selectedVibeId, promptWildcardSelections: selections }),
      }, workspaceId);
      const data = await response.json();
      if (controller.signal.aborted || request.current !== controller) return;
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not preview the prompt.');
      setPreview(data.prompt);
    } catch (error) {
      if (!controller.signal.aborted && request.current === controller) setPreviewError(error instanceof Error ? error.message : 'Could not preview the prompt.');
    } finally {
      if (!controller.signal.aborted && request.current === controller) setBusy(false);
    }
  };
  const matches = characters.filter(character => character.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const buttonClass = 'rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50';
  return <div className="space-y-2" onKeyDown={event => event.stopPropagation()} data-testid="character-prompt-tools">
    <div className="flex flex-wrap gap-2">
      <button type="button" className={buttonClass} disabled={disabled || !workspaceId} onClick={() => { setQuery(''); setPickerOpen(true); }}>Insert character</button>
      <button type="button" className={buttonClass} disabled={disabled || !workspaceId || !prompt.trim()} onClick={() => void openPreview()}>Preview prompt</button>
    </div>
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogContent className="max-h-[80dvh] max-w-lg overflow-y-auto" onKeyDown={event => event.stopPropagation()}>
        <DialogHeader><DialogTitle>Insert character</DialogTitle><DialogDescription>Insert a live reference to a saved character.</DialogDescription></DialogHeader>
        <input aria-label="Search characters" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name" className="w-full rounded-md border border-input bg-background p-3 text-base" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeOutfit} onChange={event => setIncludeOutfit(event.target.checked)} />Include outfit</label>
        <p className="text-xs text-muted-foreground">Uses the current default outfit when enabled. Otherwise, clothing is left to your prompt.</p>
        {loading ? <p>Loading characters…</p> : error ? <p role="alert">{error}</p> : !matches.length ? <p className="text-sm text-muted-foreground">No characters found in this workspace.</p> :
          <div className="max-h-[40dvh] overflow-y-auto">{matches.map(character => <button key={character.id} type="button" className="block w-full rounded-md p-3 text-left text-sm hover:bg-accent" onClick={() => { insertCharacter(character); setPickerOpen(false); }}>{character.name}</button>)}</div>}
      </DialogContent>
    </Dialog>
    <Dialog open={previewOpen} onOpenChange={open => { setPreviewOpen(open); if (!open) invalidate(); }}>
      <DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto" onKeyDown={event => event.stopPropagation()}>
        <DialogHeader><DialogTitle>Prompt preview</DialogTitle><DialogDescription>Current saved characters are used again when you generate.{randomizeSeed ? ' Randomize may select different wildcard variants.' : ' Uses the current seed and wildcard selections.'}</DialogDescription></DialogHeader>
        {busy ? <p role="status">Rendering prompt…</p> : previewError ? <p role="alert" className="text-sm text-red-400">{previewError}</p> : <pre className="whitespace-pre-wrap break-words text-sm" data-testid="character-prompt-preview">{preview}</pre>}
      </DialogContent>
    </Dialog>
  </div>;
}
