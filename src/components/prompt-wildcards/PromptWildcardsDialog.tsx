'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PromptWildcardSummary } from '@/lib/prompt-wildcards/types';

type PromptWildcardsDialogProps = {
  open: boolean;
  workspaceId?: string | null;
  onOpenChange: (open: boolean) => void;
};

type Draft = {
  id: string | null;
  name: string;
  key: string;
  value: string;
};

const emptyDraft: Draft = {
  id: null,
  name: 'New wildcard',
  key: 'newWildcard',
  value: '',
};

function toDraft(wildcard: PromptWildcardSummary): Draft {
  return {
    id: wildcard.id,
    name: wildcard.name,
    key: wildcard.key,
    value: wildcard.value,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Request failed');
  }
  return data as T;
}

export default function PromptWildcardsDialog({ open, workspaceId, onOpenChange }: PromptWildcardsDialogProps) {
  const [wildcards, setWildcards] = useState<PromptWildcardSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | 'new'>('new');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedWildcard = useMemo(
    () => wildcards.find((wildcard) => wildcard.id === selectedId) || null,
    [selectedId, wildcards],
  );

  useEffect(() => {
    if (!open || !workspaceId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(`/api/prompt-wildcards?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: 'no-store' })
      .then((response) => readJson<{ success: true; wildcards: PromptWildcardSummary[] }>(response))
      .then((data) => {
        if (cancelled) return;
        setWildcards(data.wildcards);
        const first = data.wildcards[0];
        setSelectedId(first?.id || 'new');
        setDraft(first ? toDraft(first) : emptyDraft);
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Failed to load wildcards');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  useEffect(() => {
    if (selectedId === 'new') {
      setDraft(emptyDraft);
      return;
    }
    if (selectedWildcard) setDraft(toDraft(selectedWildcard));
  }, [selectedId, selectedWildcard]);

  const saveDraft = async () => {
    if (!workspaceId) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(draft.id ? `/api/prompt-wildcards/${draft.id}` : '/api/prompt-wildcards', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          name: draft.name,
          key: draft.key,
          value: draft.value,
        }),
      });
      const data = await readJson<{ success: true; wildcard: PromptWildcardSummary }>(response);
      setWildcards((current) => {
        if (!draft.id) return [...current, data.wildcard].sort((a, b) => a.name.localeCompare(b.name));
        return current.map((wildcard) => (wildcard.id === data.wildcard.id ? data.wildcard : wildcard))
          .sort((a, b) => a.name.localeCompare(b.name));
      });
      setSelectedId(data.wildcard.id);
      setDraft(toDraft(data.wildcard));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save wildcard');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDraft = async () => {
    if (!draft.id) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/prompt-wildcards/${draft.id}`, { method: 'DELETE' });
      await readJson<{ success: true; wildcard: PromptWildcardSummary }>(response);
      setWildcards((current) => current.filter((wildcard) => wildcard.id !== draft.id));
      setSelectedId('new');
      setDraft(emptyDraft);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to delete wildcard');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-[1100px] h-[82vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-border px-5 py-4 pr-14 space-y-1 text-left">
          <DialogTitle className="text-base">Wildcards</DialogTitle>
          <DialogDescription className="text-xs">Manage prompt placeholders.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[230px_minmax(0,1fr)]">
          <aside className="border-r border-border bg-muted/10 p-3">
            <Button
              type="button"
              variant={selectedId === 'new' ? 'secondary' : 'outline'}
              size="sm"
              className="mb-3 w-full justify-start gap-2"
              onClick={() => setSelectedId('new')}
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
            <div className="space-y-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading
                </div>
              ) : wildcards.map((wildcard) => (
                <button
                  key={wildcard.id}
                  type="button"
                  onClick={() => setSelectedId(wildcard.id)}
                  className={`w-full rounded-md px-3 py-2 text-left transition-colors ${selectedId === wildcard.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                >
                  <div className="truncate text-sm font-medium">{wildcard.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{`{${wildcard.key}}`}</div>
                </button>
              ))}
            </div>
          </aside>
          <section className="flex min-h-0 flex-col p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wildcard-name">Name</Label>
                <Input
                  id="wildcard-name"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  disabled={!workspaceId || isSaving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wildcard-key">Key</Label>
                <Input
                  id="wildcard-key"
                  value={draft.key}
                  onChange={(event) => setDraft((current) => ({ ...current, key: event.target.value }))}
                  disabled={!workspaceId || isSaving}
                />
              </div>
            </div>
            <div className="mt-4 flex min-h-0 flex-1 flex-col space-y-1.5">
              <Label htmlFor="wildcard-value">Text</Label>
              <textarea
                id="wildcard-value"
                value={draft.value}
                onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
                disabled={!workspaceId || isSaving}
                className="min-h-0 flex-1 resize-none rounded-md border border-border bg-background p-3 font-mono text-xs leading-5 text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
              />
            </div>
            {error && <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
            {!workspaceId && <div className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">Select a workspace first.</div>}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="truncate text-xs text-muted-foreground">{draft.key ? `Use {${draft.key}} in prompts` : ''}</div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={deleteDraft} disabled={isSaving || !draft.id}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <Button type="button" size="sm" onClick={() => void saveDraft()} disabled={isSaving || !workspaceId || !draft.name.trim() || !draft.key.trim()}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
