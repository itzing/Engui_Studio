'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Download, Images, Plus, RefreshCw, Settings, X } from 'lucide-react';
import { useStudio } from '@/lib/context/StudioContext';
import { useWorkspaceFetch } from '@/lib/workspaces/useWorkspaceFetch';
import WorkspaceManager from '@/components/workspaces/WorkspaceManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { batchImageModels, validateBatchSettings } from '@/lib/batch-cards/settings';
import { cardIsReady, parseCardRows, missingVariantKeys, type BatchView, type BatchSettings, type TaskView } from '@/lib/batch-cards/types';
import { filterLorasForModel, type LoraFileLike } from '@/lib/lora/modelFilters';
import styles from './batch-cards.module.css';

const models = batchImageModels();
const busyStates = new Set(['queued', 'submitting', 'running', 'processing', 'queueing_up', 'saving', 'uploading', 'finalizing', 'in_queue', 'in_progress', 'submission_unknown']);
const iconNames: Record<string, string> = { gambler: 'gambler', protecter: 'protecter', protector: 'protecter', rebel: 'rebel', cheater: 'cheater', bureaucrat: 'bureaucrat', inventor: 'inventor' };
function ClassIcon({ name }: { name: string }) {
  const icon = iconNames[name.toLowerCase()];
  return icon ? <span aria-hidden="true" className={styles.classIcon} style={{ maskImage: `url(/batch-cards/classes/${icon}.png)`, WebkitMaskImage: `url(/batch-cards/classes/${icon}.png)` }} /> : <Images aria-hidden="true" size={24} />;
}
const statusLabel = (task?: TaskView) => !task ? 'Not generated' : ({ queued: 'Queued', submitting: 'Starting', processing: 'Generating', running: 'Generating', queueing_up: 'Queued', saving: 'Saving', uploading: 'Saving', finalizing: 'Saving', in_queue: 'Queued', in_progress: 'Generating', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', submission_unknown: 'Check submission' }[task.state] || task.state);
export default function BatchCardsClient() {
  const studio = useStudio();
  return <><div className={styles.mobileOnly}><h1>Batch Cards</h1><p>This workspace is available on desktop.</p><Link href="/">Back to Engui</Link></div><div className={styles.desktopOnly}>{studio.activeWorkspaceId ? <BatchWorkspace key={studio.activeWorkspaceId} workspaceId={studio.activeWorkspaceId} /> : <div className={styles.empty}><h1>Batch Cards</h1><WorkspaceManager /><Link href="/">Back to Engui</Link></div>}</div></>;
}
function BatchWorkspace({ workspaceId }: { workspaceId: string }) {
  const fetch = useWorkspaceFetch();
  const [batches, setBatches] = useState<{ id: string; title: string; cardCount: number }[]>([]);
  const [id, setId] = useState(''), [batch, setBatch] = useState<BatchView | null>(null);
  const [cardNumber, setCardNumber] = useState<number | null>(null);
  const [search, setSearch] = useState(''), [classFilter, setClassFilter] = useState('all'), [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [replaceNumber, setReplaceNumber] = useState<number | null>(null);
  const [importMode, setImportMode] = useState<'new' | 'replace' | 'overwrite' | null>(null), [json, setJson] = useState(''), [title, setTitle] = useState('');
  const [importTarget, setImportTarget] = useState<{ id: string; title: string; revision: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; revision: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false), [settings, setSettings] = useState<BatchSettings | null>(null);
  const [loras, setLoras] = useState<(LoraFileLike & { id: string; lifecycle?: string })[]>([]);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);
  const lock = useRef(false), currentId = useRef(id), currentBatch = useRef(batch), mounted = useRef(true);
  currentId.current = id; currentBatch.current = batch;
  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await fetch(path, { cache: 'no-store', ...options });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Could not complete this action.'), { status: response.status });
    return data;
  }, [fetch]);
  const accept = useCallback((view: BatchView) => {
    if (!mounted.current || currentId.current !== view.id) return;
    setBatch(old => !old || old.id !== view.id || old.revision <= view.revision ? view : old);
  }, []);
  const loadList = useCallback(async () => {
    const data = await request('/api/batch-cards');
    if (!mounted.current) return;
    setBatches(data.batches);
    if (!currentId.current && data.batches.length) {
      const saved = localStorage.getItem(`engui.batch-cards.${workspaceId}`);
      setId(data.batches.some((b: { id: string }) => b.id === saved) ? saved! : data.batches[0].id);
    }
  }, [request, workspaceId]);
  useEffect(() => { mounted.current = true; void loadList().catch(e => setError(e.message)); return () => { mounted.current = false; }; }, [loadList]);
  useEffect(() => {
    setBatch(null); setSelected(new Set()); setCardNumber(null); setImportMode(null); setDeleteTarget(null); setViewer(null); setError(''); setSearch(''); setClassFilter('all'); setFilter('all');
    if (!id) return;
    localStorage.setItem(`engui.batch-cards.${workspaceId}`, id);
    let stopped = false;
    const refresh = async () => { if (lock.current || stopped) return; try { const view = await request(`/api/batch-cards/${id}`); if (!stopped && !lock.current) accept(view); } catch (e) { if (!stopped) { if ((e as Error & { status?: number }).status === 404 && currentId.current === id) { currentId.current = ''; setId(''); localStorage.removeItem(`engui.batch-cards.${workspaceId}`); void loadList().catch(e => setError(e.message)); } else setError((e as Error).message); } } };
    void refresh(); const timer = setInterval(() => void refresh(), 3000);
    return () => { stopped = true; clearInterval(timer); };
  }, [id, request, accept, workspaceId, loadList]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); }, [notice]);
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await work(); } catch (e) {
      if (mounted.current) { setError((e as Error).message); const latestId = currentId.current; if (latestId) void request(`/api/batch-cards/${latestId}`).then(accept).catch(() => undefined); }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function mutate(action: Record<string, unknown>) {
    const view = currentBatch.current; if (!view) throw Error('Choose a batch first.');
    const result = await request(`/api/batch-cards/${view.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...action, revision: view.revision }) });
    accept(result); return result as BatchView;
  }
  const cards = batch?.document.cards || [], tasks = batch?.tasks || [];
  const taskMap = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const readyCount = cards.filter(card => cardIsReady(card, tasks)).length;
  const visible = cards.filter(card => {
    const row = card.rows[0], ready = cardIsReady(card, tasks);
    return (classFilter === 'all' || row.class === classFilter) && (filter === 'all' || (filter === 'ready' ? ready : !ready)) && `${row.n} ${row.card} ${row.effect} ${row.class}`.toLowerCase().includes(search.toLowerCase());
  });
  const card = visible.find(card => card.n === cardNumber) || visible[0];
  const index = card ? visible.indexOf(card) : -1;
  const active = (key: string) => {
    const owner = cards.find(c => c.rows.some(r => r.key === key));
    return owner ? busyStates.has(taskMap.get(owner.tasks[key])?.state || '') : false;
  };
  const canGenerate = [...selected].filter(key => !active(key) && cards.some(c => c.rows.some(r => r.key === key)));
  function changeCard(delta: number) { const next = visible[index + delta]; if (next) setCardNumber(next.n); }
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (importMode || deleteTarget || settingsOpen || viewer || (e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); setCardNumber(visible[index - 1].n); }
      if (e.key === 'ArrowRight' && index < visible.length - 1) { e.preventDefault(); setCardNumber(visible[index + 1].n); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [index, visible, importMode, deleteTarget, settingsOpen, viewer]);
  function toggle(key: string) { setSelected(old => { const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  async function generate(keys: string[]) {
    await mutate({ kind: 'generate', keys, requestKey: crypto.randomUUID() });
    setSelected(old => new Set([...old].filter(key => !keys.includes(key))));
    setNotice(`${keys.length} variant${keys.length === 1 ? '' : 's'} added to the queue.`);
  }
  function openImport(mode: 'new' | 'replace' | 'overwrite') { setJson(''); setTitle(''); setError(''); setImportTarget(batch ? { id: batch.id, title: batch.title, revision: batch.revision } : null); setReplaceNumber(mode === 'replace' ? card?.n ?? null : null); setImportMode(mode); }
  const importPreview = useMemo(() => { if (!json.trim()) return null; try { const rows = parseCardRows(json); if (importMode === 'replace' && (replaceNumber === null || rows.some(r => r.n !== replaceNumber))) throw Error('Paste only variants for this card number.'); return { rows, text: `${new Set(rows.map(r => r.n)).size} cards · ${rows.length} variants`, error: '' }; } catch (e) { return { rows: null, text: '', error: (e as Error).message }; } }, [json, importMode, replaceNumber]);
  async function importJson() {
    if (!importPreview?.rows) return;
    if (importMode === 'overwrite' && importTarget) {
      const result = await request(`/api/batch-cards/${importTarget.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'replace_batch', revision: importTarget.revision, rows: importPreview.rows }) });
      accept(result); setSelected(new Set()); setCardNumber(null); setFilter('all'); setSearch(''); setClassFilter('all'); setViewer(null); await loadList(); setNotice('Batch replaced. All previous results and Picks have been reset.');
    } else if (importMode === 'replace' && replaceNumber !== null) { const replaced = cards.find(c => c.n === replaceNumber); await mutate({ kind: 'replace', cardNumber: replaceNumber, rows: importPreview.rows }); setSelected(old => new Set([...old].filter(k => !replaced?.rows.some(r => r.key === k)))); setNotice('Card replaced. Previous results and Pick are no longer current.'); }
    else { const result = await request('/api/batch-cards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: title.trim(), rows: importPreview.rows }) }); setId(result.id); await loadList(); setNotice('Batch imported. Choose variants to generate.'); }
    setImportMode(null);
  }
  async function removeBatch() {
    if (!deleteTarget) return;
    await request(`/api/batch-cards/${deleteTarget.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: deleteTarget.revision }) });
    currentId.current = ''; currentBatch.current = null; setId(''); setBatch(null); setSelected(new Set()); setViewer(null); setDeleteTarget(null);
    localStorage.removeItem(`engui.batch-cards.${workspaceId}`); await loadList(); setNotice('Batch deleted. Existing jobs remain in history.');
  }
  async function exportJson() {
    if (!batch) return;
    const rows = await request(`/api/batch-cards/${batch.id}?export=true`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2) + '\n'], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${batch.title.replace(/[^a-z0-9_-]+/gi, '-').slice(0,100) || 'cards'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('JSON exported with current Picks.');
  }
  async function exportZip() {
    if (!batch) return;
    const response = await fetch(`/api/batch-cards/${batch.id}/zip`, { cache: 'no-store' });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Could not export picked images.'); }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `${batch.title.replace(/[^a-z0-9_-]+/gi, '-').slice(0,100) || 'cards'}-picks.zip`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('ZIP exported with all picked original images.');
  }
  async function copyName() {
    if (!card) return;
    try { await navigator.clipboard.writeText(card.rows[0].card); }
    catch { const area = document.createElement('textarea'); area.value = card.rows[0].card; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); const ok = document.execCommand('copy'); area.remove(); if (!ok) throw Error('Clipboard unavailable. Select and copy the card name.'); }
    setNotice('Card name copied.');
  }
  async function openSettings() { if (!batch) return; setSettings(structuredClone(batch.settings)); setSettingsOpen(true); const data = await request('/api/lora'); setLoras((data.loras || []).filter((l: { lifecycle?: string }) => l.lifecycle !== 'deleting')); }
  const model = models.find(m => m.id === settings?.modelId), compatible = settings ? filterLorasForModel(loras, settings.modelId) : [];
  const parameters = model?.parameters.filter(p => p.group !== 'hidden' && p.type !== 'lora-selector' && !/^loraWeight/.test(p.name) && p.name !== 'seed' && (!p.dependsOn || (settings?.parameters[p.dependsOn.parameter] ?? model.parameters.find(m => m.name === p.dependsOn!.parameter)?.default) === p.dependsOn.value)) || [];
  return <main className={styles.app}>
    <header className={styles.header}>
      <Link href="/" className={styles.back} aria-label="Back to Engui"><ArrowLeft size={20} /></Link>
      <div><h1>Batch Cards</h1><p>Generate, compare, choose.</p></div>
      <select className={styles.batchSelect} aria-label="Batch" value={id} disabled={busy} onChange={e => setId(e.target.value)}><option value="" disabled>Choose a batch</option>{batches.map(b => <option value={b.id} key={b.id}>{b.title} · {b.cardCount} cards</option>)}</select>
      <button onClick={() => openImport('new')} disabled={busy}><Plus size={16} /> Import JSON</button>
      <button onClick={() => void run(exportJson)} disabled={!batch || busy}><Download size={16} /> Export JSON</button>
      <button onClick={() => void run(exportZip)} disabled={!batch || busy || !cards.some(card => card.rows.some(row => row.pick))}><Download size={16} /> Export ZIP</button>
      <button onClick={() => void run(openSettings)} disabled={!batch || busy}><Settings size={16} /> Settings</button>
      <div className={styles.workspace}><WorkspaceManager /></div>
    </header>
    {(error || notice) && <div className={error ? styles.error : styles.notice} role={error ? 'alert' : 'status'}>{error || notice}<button aria-label="Dismiss message" onClick={() => { setError(''); setNotice(''); }}><X size={16} /></button></div>}
    <div className={styles.body}>
      <aside className={styles.sidebar} aria-label="Card navigation">
        <div className={styles.progress}><strong>{readyCount}<span> / {cards.length}</span></strong><span>cards ready</span></div>
        <div className={styles.progressBar}><span style={{ width: `${cards.length ? readyCount / cards.length * 100 : 0}%` }} /></div>
        <input aria-label="Search cards" placeholder="Search name, number or text…" value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="Filter by class" value={classFilter} onChange={e => setClassFilter(e.target.value)}><option value="all">All classes</option>{[...new Set(cards.map(c => c.rows[0].class))].sort().map(c => <option key={c}>{c}</option>)}</select>
        <div className={styles.filters}>{[['all','All'],['unfinished','Not ready'],['ready','Ready']].map(([value,label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <nav>{visible.map(c => {
          const ready = cardIsReady(c, tasks), working = c.rows.some(r => busyStates.has(taskMap.get(c.tasks[r.key])?.state || '')), failed = c.rows.some(r => taskMap.get(c.tasks[r.key])?.state === 'failed');
          return <button key={c.n} className={`${styles.cardNav} ${ready ? styles.ready : working ? styles.working : failed ? styles.failed : ''}`} aria-current={card?.n === c.n ? 'true' : undefined} aria-label={`${c.rows[0].card}${ready ? ', ready' : ''}`} onClick={() => setCardNumber(c.n)}>
            <ClassIcon name={c.rows[0].class} /><span><strong>{c.rows[0].card}</strong><small>#{c.n} · {c.rows[0].class}</small></span>{ready ? <Check size={17} /> : working ? <span className={styles.dot} /> : null}
          </button>;
        })}</nav>
        {batch && !visible.length && <p className={styles.hint}>No cards match these filters.</p>}
        {batch && <div className={styles.batchActions}><button disabled={busy} onClick={() => openImport('overwrite')}>Replace batch JSON</button><button className={styles.danger} disabled={busy} onClick={() => { setError(''); setDeleteTarget({ id: batch.id, title: batch.title, revision: batch.revision }); }}>Delete batch</button></div>}
      </aside>
      <section className={styles.content}>
        {!batch ? <div className={styles.empty}><Images size={48} /><h2>{id ? 'Loading batch…' : 'Your card collection starts here'}</h2><p>Import a JSON array with 3–5 prompt variants per card.<br />Nothing is generated until you choose to start.</p>{!id && <button className={styles.primary} onClick={() => openImport('new')}>Import JSON</button>}</div> : !card ? <div className={styles.empty}><h2>No matching cards</h2><button onClick={() => { setFilter('all'); setSearch(''); setClassFilter('all'); }}>Clear filters</button></div> : <>
          <div className={styles.cardHeading}>
            <div className={`${styles.cardIdentity} ${cardIsReady(card, tasks) ? styles.ready : ''}`}><ClassIcon name={card.rows[0].class} /><div><span className={styles.eyebrow}>#{card.n} · {card.rows[0].class}</span><h2>{card.rows[0].card}</h2></div>{cardIsReady(card, tasks) && <span className={styles.readyBadge}><Check size={15} /> Ready</span>}</div>
            <div className={styles.actions}><button onClick={() => void run(copyName)} disabled={busy}><Copy size={15} /> Copy name</button><button onClick={() => openImport('replace')} disabled={busy}>Replace card JSON</button><button aria-label="Previous card" disabled={index <= 0} onClick={() => changeCard(-1)}><ChevronLeft size={18} /></button><span>{index + 1} / {visible.length}</span><button aria-label="Next card" disabled={index >= visible.length - 1} onClick={() => changeCard(1)}><ChevronRight size={18} /></button></div>
          </div>
          <p className={styles.effect}>{card.rows[0].effect}</p>
          <div className={styles.selectionBar}>
            <button onClick={() => setSelected(old => new Set([...old, ...card.rows.filter(r => !active(r.key)).map(r => r.key)]))}>Select this card’s variants</button>
            <button onClick={() => setSelected(old => new Set([...old, ...missingVariantKeys(batch.document)]))}>Select missing in batch</button>
            {!!selected.size && <button onClick={() => setSelected(new Set())}>Clear selection</button>}
            <span>{selected.size ? `${selected.size} selected across cards` : 'Select variants to generate. Pick chooses the final result.'}</span>
            <button className={styles.primary} disabled={busy || !canGenerate.length} onClick={() => void run(() => generate(canGenerate))}><RefreshCw size={16} /> Generate selected{canGenerate.length ? ` (${canGenerate.length})` : ''}</button>
          </div>
          <div className={styles.variants} data-testid="variant-grid">{card.rows.map(row => {
            const task = taskMap.get(card.tasks[row.key]), working = !!task && busyStates.has(task.state), completed = task?.state === 'completed' && !!task.resultUrl;
            return <article key={`${card.revision}-${row.key}`} className={`${styles.variant} ${row.pick ? styles.picked : ''} ${selected.has(row.key) ? styles.selected : ''}`} data-testid={`variant-${row.variant}`}>
              <div className={styles.variantTop}><label><input aria-label={`Select variant ${row.variant}`} type="checkbox" checked={selected.has(row.key)} disabled={working || busy} onChange={() => toggle(row.key)} /><strong>{row.variant}</strong></label><span className={styles.route}>{row.route}</span>{row.pick && <span className={styles.pickLabel}><Check size={14} /> Pick</span>}</div>
              <button className={styles.preview} aria-label={`Preview variant ${row.variant}`} disabled={!completed} onClick={() => task?.resultUrl && setViewer({ url: task.resultUrl, title: `${row.card} · ${row.variant} · ${row.route}` })}>
                {completed ? <img src={task!.thumbnailUrl || task!.resultUrl!} alt={`${row.card}, variant ${row.variant}`} loading="lazy" onError={e => { if (task?.resultUrl && e.currentTarget.getAttribute('src') !== task.resultUrl) e.currentTarget.src = task.resultUrl; }} /> : <span className={styles.placeholder}>{working ? <RefreshCw className={task?.state === 'processing' ? styles.spin : ''} size={28} /> : <Images size={30} />}<span>{statusLabel(task)}</span></span>}
              </button>
              <div className={styles.variantMeta}><span>{statusLabel(task)}</span><span>{row.stylePack || '—'}</span></div>
              {task?.error && <p className={styles.taskError}>{task.error}</p>}
              <div className={styles.variantActions}><button aria-label={`Pick variant ${row.variant}`} aria-pressed={row.pick} disabled={busy || (!completed && !row.pick)} onClick={() => void run(async () => { await mutate({ kind: 'pick', cardNumber: card.n, key: row.key }); })}><Check size={16} />{row.pick ? 'Picked' : 'Pick'}</button><button aria-label={`${task ? 'Regenerate' : 'Generate'} variant ${row.variant}`} disabled={busy || working} onClick={() => void run(() => generate([row.key]))}><RefreshCw size={15} />{task ? 'Regenerate' : 'Generate'}</button></div>
              <details><summary>Prompt{task ? ` · seed ${task.seed}` : ''}</summary><p>{row.prompt}</p></details>
            </article>;
          })}</div>
        </>}
      </section>
    </div>
    <Dialog open={!!importMode} onOpenChange={open => { if (!open && !busy) setImportMode(null); }}><DialogContent className="sm:max-w-3xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{importMode === 'overwrite' ? `Replace batch “${importTarget?.title}”` : importMode === 'replace' ? `Replace ${cards.find(c => c.n === replaceNumber)?.rows[0].card}` : 'Import card batch'}</DialogTitle><DialogDescription>{importMode === 'overwrite' ? 'Replace every card with this JSON. All current results and Picks will be reset, even if the JSON contains Picks. The batch name and generation settings stay unchanged. Unsent tasks are cancelled; submitted jobs remain in history.' : importMode === 'replace' ? 'Paste variants for this card only. Its current results and Pick will be reset; other cards stay unchanged. Old jobs remain in history.' : 'Paste the complete JSON array. Original fields are preserved on export. Importing does not start generation.'}</DialogDescription></DialogHeader>
      <div className={styles.modalForm}>{importMode === 'new' && <label>Batch name<input autoFocus aria-label="Batch name" value={title} maxLength={160} onChange={e => setTitle(e.target.value)} placeholder="My card collection" /></label>}
      <label>Card JSON<textarea aria-label="Card JSON" value={json} onChange={e => setJson(e.target.value)} placeholder='[{"key":"ante_up-A", "n":1, …}]' rows={13} spellCheck={false} /></label>
      {importPreview && <p role={importPreview.error ? 'alert' : 'status'} className={importPreview.error ? styles.taskError : styles.hint}>{importPreview.error || importPreview.text}</p>}{error && <p role="alert" className={styles.taskError}>{error}</p>}
      <div className={styles.actions}><button disabled={busy} onClick={() => setImportMode(null)}>Cancel</button><button className={styles.primary} disabled={busy || !importPreview?.rows || (importMode === 'new' && !title.trim())} onClick={() => void run(importJson)}>{importMode === 'overwrite' ? 'Replace and reset batch' : importMode === 'replace' ? 'Replace and reset card' : 'Import batch'}</button></div></div>
    </DialogContent></Dialog>
    <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open && !busy) setDeleteTarget(null); }}><DialogContent><DialogHeader><DialogTitle>Delete batch “{deleteTarget?.title}”?</DialogTitle><DialogDescription>Remove this batch and its Picks from Batch Cards. Unsent tasks will be cancelled. Existing jobs and generated files remain in history; they cannot bring this batch back.</DialogDescription></DialogHeader><div className={styles.modalForm}>{error && <p role="alert" className={styles.taskError}>{error}</p>}<div className={styles.actions}><button disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</button><button className={styles.danger} disabled={busy} onClick={() => void run(removeBatch)}>Delete batch</button></div></div></DialogContent></Dialog>
    <Dialog open={settingsOpen} onOpenChange={open => { if (!busy) setSettingsOpen(open); }}><DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Batch generation settings</DialogTitle><DialogDescription>Used for new attempts in this batch. Existing and queued results keep their original settings.</DialogDescription></DialogHeader>{settings && <div className={styles.modalForm}>
      <label>Model<select aria-label="Generation model" value={settings.modelId} onChange={e => { const m = models.find(m => m.id === e.target.value)!; setSettings({ ...settings, modelId: m.id, parameters: {}, loras: [] }); }}>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <div className={styles.parameterGrid}>{parameters.map(p => <label key={p.name}>{p.label}{p.type === 'select' ? <select aria-label={p.label} value={String(settings.parameters[p.name] ?? p.default ?? '')} onChange={e => setSettings({ ...settings, parameters: { ...settings.parameters, [p.name]: e.target.value } })}>{p.options?.map(o => <option key={o}>{o}</option>)}</select> : p.type === 'boolean' ? <input type="checkbox" checked={Boolean(settings.parameters[p.name] ?? p.default)} onChange={e => setSettings({ ...settings, parameters: { ...settings.parameters, [p.name]: e.target.checked } })} /> : <input aria-label={p.label} type={p.type === 'number' ? 'number' : 'text'} min={p.min} max={p.max} step={p.validation?.multipleOf || p.step || 'any'} value={String(settings.parameters[p.name] ?? p.default ?? '')} onChange={e => setSettings({ ...settings, parameters: { ...settings.parameters, [p.name]: p.type === 'number' ? Number(e.target.value) : e.target.value } })} />}</label>)}</div>
      <label className={styles.checkLabel}><input type="checkbox" checked={settings.randomizeSeed} onChange={e => setSettings({ ...settings, randomizeSeed: e.target.checked })} /> New random seed for each variant</label>{!settings.randomizeSeed && <label>Seed<input type="number" min={0} max={2147483646} value={settings.seed} onChange={e => setSettings({ ...settings, seed: Number(e.target.value) })} /></label>}
      {model?.parameters.some(p => p.type === 'lora-selector') && <fieldset><legend>LoRAs</legend>{settings.loras.map((l, i) => <div className={styles.loraRow} key={i}><select aria-label={`LoRA ${i + 1}`} value={l.id} onChange={e => setSettings({ ...settings, loras: settings.loras.map((v,j) => j === i ? { ...v, id: e.target.value } : v) })}><option value="">Choose LoRA</option>{compatible.map(v => <option key={v.id} value={v.id}>{v.name || v.fileName}</option>)}</select><input aria-label={`LoRA ${i + 1} weight`} type="number" min={-10} max={10} step={0.1} value={l.weight} onChange={e => setSettings({ ...settings, loras: settings.loras.map((v,j) => j === i ? { ...v, weight: Number(e.target.value) } : v) })} /><button aria-label={`Remove LoRA ${i + 1}`} onClick={() => setSettings({ ...settings, loras: settings.loras.filter((_,j) => j !== i) })}><X size={16} /></button></div>)}<button disabled={settings.loras.length >= 8 || !compatible.length} onClick={() => setSettings({ ...settings, loras: [...settings.loras, { id: '', weight: 1 }] })}>Add LoRA</button>{!compatible.length && <p className={styles.hint}>No compatible LoRAs in this workspace.</p>}</fieldset>}
      {error && <p role="alert" className={styles.taskError}>{error}</p>}<div className={styles.actions}><button disabled={busy} onClick={() => setSettingsOpen(false)}>Cancel</button><button className={styles.primary} disabled={busy} onClick={() => void run(async () => { await mutate({ kind: 'settings', settings: validateBatchSettings(settings) }); setSettingsOpen(false); setNotice('Batch settings saved.'); })}>Save settings</button></div>
    </div>}</DialogContent></Dialog>
    <Dialog open={!!viewer} onOpenChange={open => { if (!open) setViewer(null); }}><DialogContent className="sm:max-w-[92vw] max-h-[94dvh] overflow-auto"><DialogHeader><DialogTitle>{viewer?.title}</DialogTitle><DialogDescription>Full-size generated variant</DialogDescription></DialogHeader>{viewer && <img src={viewer.url} alt={viewer.title} className={styles.fullImage} />}</DialogContent></Dialog>
  </main>;
}
