'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Eraser, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceFetch } from '@/lib/workspaces/useWorkspaceFetch';
import { useStudio } from '@/lib/context/StudioContext';
import type { VibePresetSummary } from '@/lib/vibes/types';

type Props = {
  prompt: string;
  selectedVibeId: string;
  onSelect: (id: string) => void;
  scopeKey: string;
  sourceKey?: string;
  disabled?: boolean;
  onApplyPrompt: (prompt: string) => () => void;
  onBusyChange: (busy: boolean) => void;
};

export default function ImageVibeControls(props: Props) {
  const fetch = useWorkspaceFetch();
  const { settings, activeWorkspaceId } = useStudio();
  const selectId = useId();
  const [vibes, setVibes] = useState<VibePresetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [message, setMessage] = useState('');
  const [stripping, setStripping] = useState(false);
  const [undo, setUndo] = useState<{ after: string; scope: string; restore: () => void } | null>(null);
  const request = useRef<AbortController | null>(null);
  const context = JSON.stringify([props.scopeKey, props.sourceKey, props.prompt]);
  const latest = useRef({ context, props });
  latest.current = { context, props };
  const configured = settings.promptHelper?.provider === 'local'
    && !!settings.promptHelper.local?.baseUrl?.trim() && !!settings.promptHelper.local?.model?.trim();

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | undefined;
    const refresh = async () => {
      controller?.abort();
      const own = new AbortController();
      controller = own;
      setLoading(true);
      try {
        const response = await fetch('/api/vibes?status=active', { cache: 'no-store', signal: own.signal });
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.vibes)) throw new Error('Could not load Vibes');
        if (!cancelled && !own.signal.aborted) {
          setVibes(data.vibes.filter((vibe: VibePresetSummary) => vibe.status === 'active'));
          setListError('');
        }
      } catch {
        if (!cancelled && !own.signal.aborted) setListError('Could not load Vibes. Reopen Create to retry.');
      } finally {
        if (!cancelled && !own.signal.aborted) setLoading(false);
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; controller?.abort(); window.removeEventListener('focus', refresh); };
  }, [activeWorkspaceId, fetch]);

  useEffect(() => {
    setStripping(false);
    return () => { request.current?.abort(); request.current = null; props.onBusyChange(false); };
  }, [context, props.onBusyChange]);

  useEffect(() => {
    setStripping(false);
    setMessage('');
    setUndo(null);
  }, [props.scopeKey]);

  const strip = async () => {
    if (request.current || props.disabled || !configured || !props.prompt.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    setStripping(true);
    props.onBusyChange(true);
    setMessage('');
    try {
      const response = await fetch('/api/vibes/strip', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: props.prompt }),
      });
      const data = await response.json();
      if (controller.signal.aborted || latest.current.context !== context) return;
      if (!response.ok || !data.success || typeof data.prompt !== 'string' || !data.prompt.trim()) {
        throw new Error(data.error || 'Could not strip the vibe. Your prompt was kept.');
      }
      if (data.prompt === props.prompt) { setMessage('No vibe changes needed'); return; }
      const restore = props.onApplyPrompt(data.prompt);
      setUndo({ after: data.prompt, scope: props.scopeKey, restore });
      setMessage('Vibe stripped');
    } catch (error) {
      if (!controller.signal.aborted && latest.current.context === context) {
        setMessage(error instanceof Error ? error.message : 'Could not strip the vibe. Your prompt was kept.');
      }
    } finally {
      if (request.current === controller || request.current === null) {
        request.current = null;
        setStripping(false);
        props.onBusyChange(false);
      }
    }
  };

  const selected = vibes.find((vibe) => vibe.id === props.selectedVibeId);
  const canUndo = undo && undo.after === props.prompt && undo.scope === props.scopeKey && !props.sourceKey;
  return (
    <section className="min-w-0 space-y-2 rounded-lg border border-border bg-secondary/30 p-3" aria-label="Image vibe">
      <label htmlFor={selectId} className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">Vibe</label>
      <select id={selectId} aria-label="Vibe" data-testid="image-vibe-selector"
        className="h-11 w-full min-w-0 rounded-lg border border-border bg-secondary/50 px-3 text-sm text-foreground" style={{ colorScheme: 'dark' }}
        value={props.selectedVibeId} disabled={props.disabled || stripping}
        onChange={(event) => props.onSelect(event.target.value)}>
        <option value="">None</option>
        {props.selectedVibeId && !selected && <option value={props.selectedVibeId}>{loading ? 'Loading selected Vibe...' : 'Selected Vibe unavailable'}</option>}
        {vibes.map((vibe) => <option key={vibe.id} value={vibe.id}>{vibe.name}</option>)}
      </select>
      {selected && <p className="line-clamp-3 break-words text-xs text-muted-foreground" title={selected.baseDescription}>{selected.baseDescription}</p>}
      <p className="text-xs text-muted-foreground">Added before your prompt when generating.</p>
      {loading && <p className="text-xs text-muted-foreground">Loading Vibes...</p>}
      {listError && <p role="status" className="text-xs text-destructive">{listError}</p>}
      {!loading && !listError && !vibes.length && <p className="text-xs text-muted-foreground">Add Vibes in the desktop Vibes section.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="min-h-11 gap-2"
          disabled={props.disabled || stripping || !props.prompt.trim() || !configured} onClick={() => void strip()}>
          {stripping ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Eraser aria-hidden="true" className="h-4 w-4" />}
          {stripping ? 'Stripping vibe...' : 'Strip vibe'}
        </Button>
        {canUndo && <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-2" disabled={props.disabled || stripping}
          onClick={() => { undo.restore(); setUndo(null); setMessage('Vibe cleanup undone'); }}>
          <RotateCcw aria-hidden="true" className="h-4 w-4" />Undo
        </Button>}
      </div>
      <p className="text-xs text-muted-foreground">Remove lighting, atmosphere and mood from the current prompt.</p>
      {props.sourceKey && <p className="text-xs text-muted-foreground">Stripping switches to a manual copy. The saved draft stays unchanged.</p>}
      {!configured && <p className="text-xs text-muted-foreground">Configure Prompt Helper in Settings to strip a vibe.</p>}
      {message && <p role="status" className="text-sm" data-testid="image-vibe-feedback">{message}</p>}
    </section>
  );
}
