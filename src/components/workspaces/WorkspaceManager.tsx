'use client';
import { useEffect, useState } from 'react';
import { useStudio } from '@/lib/context/StudioContext';
import { workspaceFetch } from '@/lib/workspaces/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function WorkspaceManager() {
  const studio = useStudio();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [deletions, setDeletions] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = studio.workspaces.find(w => w.id === studio.activeWorkspaceId);
  async function refresh() {
    const response = await workspaceFetch('/api/workspaces');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load workspaces.');
    setDeletions(data.deletions || []);
    await studio.refreshWorkspaces();
  }
  useEffect(() => {
    if (!open) return;
    void refresh().catch(e => setError(e.message));
    const timer = setInterval(() => void refresh().catch(e => setError(e.message)), 5000);
    return () => clearInterval(timer);
  }, [open, studio.activeWorkspaceId]);
  async function run(task: () => Promise<void>) {
    setBusy(true); setError('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Workspace action failed.'); }
    finally { setBusy(false); }
  }
  async function showDeletion(id: string) {
    const response = await workspaceFetch('/api/workspaces/' + id + '?deletionPreview=true');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not prepare deletion.');
    setPreview(data); setConfirmation('');
  }
  return <section className="space-y-2" aria-label="Workspace controls">
    <div className="flex items-center gap-2">
      <select aria-label="Active workspace" className="min-w-0 flex-1 rounded border border-border bg-background p-2 text-sm" value={studio.activeWorkspaceId || ''} onChange={e => studio.selectWorkspace(e.target.value)}>
        <option value="" disabled>Choose workspace</option>
        {studio.workspaces.filter(w => w.lifecycle === 'active').map(w => <option key={w.id} value={w.id}>{w.name}{w.isProtected ? ' (Default)' : ''}</option>)}
      </select>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Manage</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Workspaces</DialogTitle><DialogDescription>Content is separate. Keys, connections and application settings are shared.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void run(async () => { if (renameId) await studio.renameWorkspace(renameId, name); else await studio.createWorkspace(name); setName(''); setRenameId(null); }); }}>
          <Input aria-label={renameId ? 'New workspace name' : 'Workspace name'} value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder={renameId ? 'New name' : 'New workspace name'} />
          <Button disabled={busy || !name.trim()}>{renameId ? 'Rename' : 'Create'}</Button>
          {renameId && <Button type="button" variant="ghost" onClick={() => { setRenameId(null); setName(''); }}>Cancel</Button>}
        </form>
        {studio.workspaces.map(w => {
          const operation = deletions.find(d => d.workspaceId === w.id);
          return <div key={w.id} className="space-y-2 rounded border border-border p-3">
            <div className="flex items-center gap-2"><span className="flex-1 break-words font-medium">{w.name}</span>{w.isProtected && <span className="text-xs">Protected Default</span>}{w.id === current?.id && <span className="text-xs">Selected</span>}</div>
            {w.lifecycle === 'active' ? <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={w.id === current?.id} onClick={() => { studio.selectWorkspace(w.id); setOpen(false); }}>Switch</Button>
              <Button size="sm" variant="outline" onClick={() => { setRenameId(w.id); setName(w.name); }}>Rename</Button>
              {!w.isProtected && <Button size="sm" variant="destructive" disabled={busy} onClick={() => void run(() => showDeletion(w.id))}>Delete</Button>}
            </div> : <div className="space-y-2 text-sm">
              <p>Deletion {operation?.status || 'pending'} · {operation?.stage || 'draining jobs'}</p>
              {operation?.error && <p role="alert">{operation.error}</p>}
              {operation?.status === 'failed' && <Button size="sm" variant="outline" onClick={() => void run(async () => { await studio.deleteWorkspace(w.id); await refresh(); })}>Retry cleanup</Button>}
            </div>}
          </div>;
        })}
        {preview && <div className="space-y-3 rounded border border-destructive p-3">
          <h3 className="font-semibold">Delete {preview.workspace.name}?</h3>
          <p className="text-sm">{preview.warning}</p>
          <ul className="text-xs">{Object.entries(preview.counts as Record<string, number>).filter(([, count]) => count > 0).map(([kind, count]) => <li key={kind}>{kind}: {count}</li>)}</ul>
          <Input aria-label="Confirm workspace name" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder={preview.workspace.name} />
          <div className="flex gap-2">
            <Button variant="destructive" disabled={busy || confirmation !== preview.workspace.name} onClick={() => void run(async () => { await studio.deleteWorkspace(preview.workspace.id); setPreview(null); await refresh(); })}>Delete everything</Button>
            <Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>Cancel</Button>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </section>;
}
