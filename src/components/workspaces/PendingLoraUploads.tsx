'use client';
import { useEffect, useState } from 'react';
import { useWorkspaceFetch } from '@/lib/workspaces/useWorkspaceFetch';
import { Button } from '@/components/ui/button';
export default function PendingLoraUploads({ onChange }: { onChange: () => unknown }) {
  const fetch = useWorkspaceFetch();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const response = await fetch('/api/lora/uploads');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load pending uploads.');
    setRows(data.uploads || []);
  }
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, []);
  async function recover(row: any, action: 'finalize' | 'abort') {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/lora/multipart/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload recovery failed.');
      await refresh(); await onChange();
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload recovery failed.'); }
    finally { setBusy(false); }
  }
  if (!rows.length && !error) return null;
  return <section className="space-y-2 rounded border border-border p-3">
    <h3 className="text-sm font-medium">Pending server uploads</h3>
    <p className="text-xs text-muted-foreground">After an interrupted upload, finish received parts or discard the unpublished upload. Sync waits until uploads are resolved.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {rows.map(row => <div key={row.uploadId} className="flex flex-wrap items-center gap-2">
      <span className="flex-1 break-all text-xs">{row.fileName}</span>
      {!row.volume ? <span className="text-xs">Restore the original S3 connection to recover.</span> : <>
        {!row.uploadId.startsWith('initializing:') && <Button size="sm" variant="outline" disabled={busy} onClick={() => void recover(row, 'finalize')}>Finish upload</Button>}
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => void recover(row, 'abort')}>Discard upload</Button>
      </>}
    </div>)}
  </section>;
}
