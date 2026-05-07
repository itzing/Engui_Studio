'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, FolderOpen, Grid2X2, Image, Layers3, Plus, Rows3, UserRound } from 'lucide-react';
import CharacterSelectModal from '@/components/characters/CharacterSelectModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useStudio } from '@/lib/context/StudioContext';
import type { CharacterSummary } from '@/lib/characters/types';
import type { StudioCollectionItemSummary, StudioCollectionSummary, StudioPhotoSessionSummary, StudioPortfolioSummary, StudioPoseSetSummary, StudioSessionRunSummary, StudioSessionShotVersionSummary } from '@/lib/studio-sessions/types';

type FStudioRoute =
  | { level: 'portfolios' }
  | { level: 'portfolio'; portfolioId: string; section?: 'sessions' | 'collections' }
  | { level: 'session'; portfolioId: string; sessionId: string }
  | { level: 'runs'; portfolioId: string; sessionId: string }
  | { level: 'run'; portfolioId: string; sessionId: string; runId: string }
  | { level: 'collection'; portfolioId: string; collectionId: string };

type RunDetail = { run?: StudioSessionRunSummary; shots?: Array<{ id: string; label: string; category: string }>; versions?: StudioSessionShotVersionSummary[] };
type CollectionDetail = { collection: StudioCollectionSummary; items: StudioCollectionItemSummary[] } | null;

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function characterMeta(portfolio: StudioPortfolioSummary | null) {
  if (!portfolio) return '';
  const parts = [portfolio.characterAge ? `${portfolio.characterAge.replace(/yo$/i, '')}yo` : '', portfolio.characterGender || ''].filter(Boolean);
  return parts.length ? `${portfolio.characterName} (${parts.join('/')})` : portfolio.characterName;
}

function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">{children}</div>;
}

function AddTile({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.025] text-white/60 transition hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-white">
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition group-hover:border-blue-300/50"><Plus className="h-8 w-8" /></div>
      <div className="text-sm font-medium">{label}</div>
    </button>
  );
}

function PortfolioTile({ portfolio }: { portfolio: StudioPortfolioSummary }) {
  return (
    <Link href={`/studio-sessions/portfolios/${portfolio.id}`} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:border-white/25 hover:bg-white/[0.06]">
      <div className="relative aspect-[4/3] bg-black/30">
        {portfolio.characterPreviewUrl ? <img src={portfolio.characterPreviewUrl} alt={portfolio.characterName} className="h-full w-full object-cover transition group-hover:scale-[1.02]" /> : <div className="flex h-full items-center justify-center text-white/30"><UserRound className="h-12 w-12" /></div>}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4">
          <div className="truncate text-base font-semibold text-white">{portfolio.characterName}</div>
          <div className="truncate text-xs text-white/60">{[portfolio.characterAge ? `${portfolio.characterAge.replace(/yo$/i, '')}yo` : '', portfolio.characterGender].filter(Boolean).join(' / ')}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 p-4 text-xs text-white/55">
        <span>{portfolio.sessionCount} sessions</span><span>·</span><span>{portfolio.collectionCount} collections</span>
      </div>
    </Link>
  );
}

function SimpleTile({ title, subtitle, href, icon }: { title: string; subtitle?: string; href: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group flex min-h-[180px] flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-white/25 hover:bg-white/[0.06]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-white/55">{icon}</div>
      <div>
        <div className="truncate text-base font-semibold text-white">{title}</div>
        {subtitle ? <div className="mt-1 line-clamp-2 text-xs text-white/50">{subtitle}</div> : null}
      </div>
    </Link>
  );
}

function Sidebar({ route, portfolioId, sessionId, collapsed, onToggle }: { route: FStudioRoute; portfolioId?: string | null; sessionId?: string | null; collapsed: boolean; onToggle: () => void }) {
  const items = [
    { key: 'portfolios', label: 'Portfolios', icon: Grid2X2, href: '/studio-sessions', visible: true, active: route.level === 'portfolios' },
    { key: 'sessions', label: 'Sessions', icon: Rows3, href: portfolioId ? `/studio-sessions/portfolios/${portfolioId}` : '#', visible: Boolean(portfolioId), active: route.level === 'portfolio' || route.level === 'session' },
    { key: 'runs', label: 'Runs', icon: Layers3, href: portfolioId && sessionId ? `/studio-sessions/portfolios/${portfolioId}/sessions/${sessionId}/runs` : '#', visible: Boolean(portfolioId && sessionId), active: route.level === 'runs' || route.level === 'run' },
    { key: 'collections', label: 'Collections', icon: FolderOpen, href: portfolioId ? `/studio-sessions/portfolios/${portfolioId}/collections` : '#', visible: Boolean(portfolioId), active: route.level === 'collection' || (route.level === 'portfolio' && route.section === 'collections') },
  ];
  return (
    <aside className={`${collapsed ? 'w-[76px]' : 'w-64'} shrink-0 border-r border-white/10 bg-[#101014] p-3 transition-all`}>
      <Button variant="outline" onClick={onToggle} className="mb-4 h-10 w-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">{collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="mr-2 h-4 w-4" /> Collapse</>}</Button>
      <nav className="space-y-2">
        {items.filter((item) => item.visible).map((item) => {
          const Icon = item.icon;
          return <Link key={item.key} href={item.href} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition ${item.active ? 'bg-blue-500/15 text-blue-100' : 'text-white/60 hover:bg-white/[0.06] hover:text-white'}`}><Icon className="h-4 w-4 shrink-0" />{collapsed ? null : <span>{item.label}</span>}</Link>;
        })}
      </nav>
    </aside>
  );
}

function Header({ breadcrumbs }: { breadcrumbs: Array<{ label: string; href?: string }> }) {
  return (
    <header className="border-b border-white/10 bg-[#0f0f11]/95 px-8 py-5">
      <div className="text-3xl font-semibold tracking-tight text-white">F-Studio</div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/45">
        {breadcrumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">{index > 0 ? <span className="text-white/25">→</span> : null}{crumb.href ? <Link href={crumb.href} className="text-white/65 hover:text-white">{crumb.label}</Link> : <span className="text-white">{crumb.label}</span>}</span>)}
      </div>
    </header>
  );
}

export default function FStudioPageClient({ route }: { route: FStudioRoute }) {
  const router = useRouter();
  const { activeWorkspaceId } = useStudio();
  const [collapsed, setCollapsed] = useState(false);
  const [portfolios, setPortfolios] = useState<StudioPortfolioSummary[]>([]);
  const [sessions, setSessions] = useState<StudioPhotoSessionSummary[]>([]);
  const [collections, setCollections] = useState<StudioCollectionSummary[]>([]);
  const [runs, setRuns] = useState<StudioSessionRunSummary[]>([]);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [collectionDetail, setCollectionDetail] = useState<CollectionDetail>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [poseSets, setPoseSets] = useState<StudioPoseSetSummary[]>([]);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedPoseSetId, setSelectedPoseSetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portfolioId = 'portfolioId' in route ? route.portfolioId : null;
  const sessionId = 'sessionId' in route ? route.sessionId : null;
  const selectedPortfolio = useMemo(() => portfolios.find((portfolio) => portfolio.id === portfolioId) ?? null, [portfolioId, portfolios]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === sessionId) ?? null, [sessionId, sessions]);
  const selectedRun = useMemo(() => runs.find((run) => route.level === 'run' && run.id === route.runId) ?? runDetail?.run ?? null, [route, runDetail?.run, runs]);

  useEffect(() => { setCollapsed(localStorage.getItem('f-studio-sidebar-collapsed') === '1'); }, []);
  const toggleCollapsed = () => setCollapsed((next) => { localStorage.setItem('f-studio-sidebar-collapsed', next ? '0' : '1'); return !next; });

  const fetchJson = useCallback(async (url: string, fallback: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : fallback);
    return data;
  }, []);

  const refreshPortfolios = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const data = await fetchJson(`/api/studio/portfolios?workspaceId=${encodeURIComponent(activeWorkspaceId)}`, 'Failed to fetch portfolios');
    setPortfolios(Array.isArray(data.portfolios) ? data.portfolios : []);
  }, [activeWorkspaceId, fetchJson]);

  const refreshPortfolioDetail = useCallback(async (id: string) => {
    const data = await fetchJson(`/api/studio/portfolios/${encodeURIComponent(id)}`, 'Failed to fetch portfolio');
    setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    setCollections(Array.isArray(data.collections) ? data.collections : []);
  }, [fetchJson]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        await refreshPortfolios();
        const charData = await fetchJson('/api/characters', 'Failed to fetch characters');
        if (!cancelled) setCharacters(Array.isArray(charData.characters) ? charData.characters : []);
        const poseData = await fetchJson('/api/studio/pose-sets', 'Failed to fetch pose sets');
        if (!cancelled) setPoseSets(Array.isArray(poseData.poseSets) ? poseData.poseSets : []);
      } catch (err) { if (!cancelled) setError(toErrorMessage(err, 'Failed to load F-Studio')); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [fetchJson, refreshPortfolios]);

  useEffect(() => { if (portfolioId) refreshPortfolioDetail(portfolioId).catch((err) => setError(toErrorMessage(err, 'Failed to load portfolio'))); }, [portfolioId, refreshPortfolioDetail]);
  useEffect(() => {
    if (!sessionId) { setRuns([]); return; }
    fetchJson(`/api/studio/sessions/${encodeURIComponent(sessionId)}`, 'Failed to fetch session').then((data) => setRuns(Array.isArray(data.runs) ? data.runs : [])).catch((err) => setError(toErrorMessage(err, 'Failed to load session')));
  }, [fetchJson, sessionId]);
  useEffect(() => {
    if (route.level !== 'run') { setRunDetail(null); return; }
    fetchJson(`/api/studio/runs/${encodeURIComponent(route.runId)}`, 'Failed to fetch run').then(setRunDetail).catch((err) => setError(toErrorMessage(err, 'Failed to load run')));
  }, [fetchJson, route]);
  useEffect(() => {
    if (route.level !== 'collection') { setCollectionDetail(null); return; }
    fetchJson(`/api/studio/collections/${encodeURIComponent(route.collectionId)}`, 'Failed to fetch collection').then((data) => setCollectionDetail({ collection: data.collection, items: Array.isArray(data.items) ? data.items : [] })).catch((err) => setError(toErrorMessage(err, 'Failed to load collection')));
  }, [fetchJson, route]);

  const breadcrumbs = useMemo(() => {
    const crumbs: Array<{ label: string; href?: string }> = [{ label: 'Portfolios', href: route.level === 'portfolios' ? undefined : '/studio-sessions' }];
    if (selectedPortfolio && portfolioId) crumbs.push({ label: characterMeta(selectedPortfolio), href: route.level === 'portfolio' ? undefined : `/studio-sessions/portfolios/${portfolioId}` });
    if (route.level === 'session' || route.level === 'runs' || route.level === 'run') crumbs.push({ label: 'Sessions', href: portfolioId ? `/studio-sessions/portfolios/${portfolioId}` : undefined });
    if ((route.level === 'session' || route.level === 'runs' || route.level === 'run') && selectedSession) crumbs.push({ label: selectedSession.name, href: route.level === 'session' ? undefined : `/studio-sessions/portfolios/${portfolioId}/sessions/${selectedSession.id}` });
    if (route.level === 'runs' || route.level === 'run') crumbs.push({ label: 'Runs', href: route.level === 'runs' ? undefined : `/studio-sessions/portfolios/${portfolioId}/sessions/${sessionId}/runs` });
    if (route.level === 'run' && selectedRun) crumbs.push({ label: selectedRun.name || 'Run' });
    if ((route.level === 'collection' || (route.level === 'portfolio' && route.section === 'collections')) && portfolioId) crumbs.push({ label: 'Collections', href: route.level === 'collection' ? `/studio-sessions/portfolios/${portfolioId}/collections` : undefined });
    if (route.level === 'collection' && collectionDetail?.collection) crumbs.push({ label: collectionDetail.collection.name });
    return crumbs;
  }, [collectionDetail?.collection, portfolioId, route, selectedPortfolio, selectedRun, selectedSession, sessionId]);

  async function createPortfolio(character: CharacterSummary) {
    if (!activeWorkspaceId) return;
    const response = await fetch('/api/studio/portfolios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: activeWorkspaceId, characterId: character.id }) });
    const data = await response.json();
    if (data?.success) router.push(`/studio-sessions/portfolios/${data.portfolio.id}`); else setError(data?.error || 'Failed to create portfolio');
  }
  async function createSession() {
    if (!portfolioId) return;
    const response = await fetch(`/api/studio/portfolios/${portfolioId}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName || 'New photo session' }) });
    const data = await response.json();
    if (data?.success) router.push(`/studio-sessions/portfolios/${portfolioId}/sessions/${data.session.id}`); else setError(data?.error || 'Failed to create session');
  }
  async function createCollection() {
    if (!portfolioId) return;
    const response = await fetch(`/api/studio/portfolios/${portfolioId}/collections`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName || 'New collection' }) });
    const data = await response.json();
    if (data?.success) router.push(`/studio-sessions/portfolios/${portfolioId}/collections/${data.collection.id}`); else setError(data?.error || 'Failed to create collection');
  }
  async function createRun() {
    if (!portfolioId || !sessionId || !selectedPoseSetId) return;
    const pose = poseSets.find((item) => item.id === selectedPoseSetId);
    const response = await fetch(`/api/studio/sessions/${sessionId}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName || pose?.name || 'New run', poseSetId: selectedPoseSetId, count: 5 }) });
    const data = await response.json();
    if (data?.success) router.push(`/studio-sessions/portfolios/${portfolioId}/sessions/${sessionId}/runs/${data.run.id}`); else setError(data?.error || 'Failed to create run');
  }

  function renderCanvas() {
    if (!activeWorkspaceId) return <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">Select or create a workspace before using F-Studio.</div>;
    if (loading) return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8 text-white/50">Loading…</div>;
    if (route.level === 'portfolios') return <TileGrid><AddTile label="New portfolio" onClick={() => setShowCreatePortfolio(true)} />{portfolios.map((portfolio) => <PortfolioTile key={portfolio.id} portfolio={portfolio} />)}</TileGrid>;
    if (route.level === 'portfolio' && route.section === 'collections') return <TileGrid><AddTile label="New collection" onClick={() => { setNewName(''); setShowCreateCollection(true); }} />{collections.map((collection) => <SimpleTile key={collection.id} title={collection.name} subtitle={`${collection.itemCount} photos`} href={`/studio-sessions/portfolios/${portfolioId}/collections/${collection.id}`} icon={<Image className="h-5 w-5" />} />)}</TileGrid>;
    if (route.level === 'portfolio') return <TileGrid><AddTile label="New session" onClick={() => { setNewName(''); setShowCreateSession(true); }} />{sessions.map((session) => <SimpleTile key={session.id} title={session.name} subtitle={[session.settingText, session.vibeText, `${session.runCount} runs`].filter(Boolean).join(' · ')} href={`/studio-sessions/portfolios/${portfolioId}/sessions/${session.id}`} icon={<Rows3 className="h-5 w-5" />} />)}</TileGrid>;
    if (route.level === 'session') return <Card className="border-white/10 bg-white/[0.035] text-white"><CardContent className="space-y-4 p-6"><div className="text-xl font-semibold">{selectedSession?.name || 'Session'}</div><div className="grid gap-4 md:grid-cols-2"><Info label="Setting" value={selectedSession?.settingText} /><Info label="Lighting" value={selectedSession?.lightingText} /><Info label="Vibe" value={selectedSession?.vibeText} /><Info label="Outfit" value={selectedSession?.outfitText} /></div><Button onClick={() => router.push(`/studio-sessions/portfolios/${portfolioId}/sessions/${sessionId}/runs`)} className="bg-blue-500 text-white hover:bg-blue-400">Open runs</Button></CardContent></Card>;
    if (route.level === 'runs') return <TileGrid><AddTile label="New run" onClick={() => { setNewName(''); setSelectedPoseSetId(poseSets[0]?.id || ''); setShowCreateRun(true); }} />{runs.map((run) => <SimpleTile key={run.id} title={run.name || run.poseSetId || 'Run'} subtitle={`${run.count} shots · ${run.status}`} href={`/studio-sessions/portfolios/${portfolioId}/sessions/${sessionId}/runs/${run.id}`} icon={<Layers3 className="h-5 w-5" />} />)}</TileGrid>;
    if (route.level === 'run') return <RunWorkspace detail={runDetail} />;
    if (route.level === 'collection') return <CollectionWorkspace detail={collectionDetail} />;
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#0b0b0d] text-white">
      <Sidebar route={route} portfolioId={portfolioId} sessionId={sessionId} collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header breadcrumbs={breadcrumbs} />
        <main className="min-w-0 flex-1 overflow-auto p-8">
          {error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
          {renderCanvas()}
        </main>
      </div>
      <CharacterSelectModal open={showCreatePortfolio} characters={characters} loading={false} selectedCharacterId={null} onOpenChange={setShowCreatePortfolio} onSelect={createPortfolio} />
      <NameDialog open={showCreateSession} title="New session" value={newName} onChange={setNewName} onOpenChange={setShowCreateSession} onSubmit={createSession} />
      <NameDialog open={showCreateCollection} title="New collection" value={newName} onChange={setNewName} onOpenChange={setShowCreateCollection} onSubmit={createCollection} />
      <Dialog open={showCreateRun} onOpenChange={setShowCreateRun}><DialogContent className="border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle>New run</DialogTitle><DialogDescription className="text-white/50">Choose one pose set for this run.</DialogDescription></DialogHeader><Input value={newName} onChange={(event) => setNewName(event.target.value)} className="border-white/10 bg-black/30 text-white" placeholder="Run name" /><select value={selectedPoseSetId} onChange={(event) => setSelectedPoseSetId(event.target.value)} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white">{poseSets.map((poseSet) => <option key={poseSet.id} value={poseSet.id}>{poseSet.name}</option>)}</select><Button onClick={createRun} disabled={!selectedPoseSetId} className="bg-blue-500 text-white hover:bg-blue-400">Create run</Button></DialogContent></Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) { return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</div><div className="mt-2 text-sm text-white/75">{value || 'Not set'}</div></div>; }
function NameDialog({ open, title, value, onChange, onOpenChange, onSubmit }: { open: boolean; title: string; value: string; onChange: (value: string) => void; onOpenChange: (open: boolean) => void; onSubmit: () => void }) { return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><Input value={value} onChange={(event) => onChange(event.target.value)} className="border-white/10 bg-black/30 text-white" placeholder="Name" /><Button onClick={onSubmit} className="bg-blue-500 text-white hover:bg-blue-400">Create</Button></DialogContent></Dialog>; }
function RunWorkspace({ detail }: { detail: RunDetail | null }) { const versions = detail?.versions || []; return <div className="space-y-5"><div className="text-xl font-semibold">{detail?.run?.name || 'Run'}</div><TileGrid>{versions.map((version) => { const url = version.previewUrl || version.thumbnailUrl || version.originalUrl; return <div key={version.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="aspect-[3/4] bg-black/35">{url ? <img src={url} alt="Version" className="h-full w-full object-cover" /> : null}</div><div className="p-4 text-xs text-white/55">v{version.versionNumber} · {version.reviewState}</div></div>; })}{versions.length === 0 ? <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-white/45">No generated versions yet.</div> : null}</TileGrid></div>; }
function CollectionWorkspace({ detail }: { detail: CollectionDetail }) { return <div className="space-y-5"><div className="text-xl font-semibold">{detail?.collection.name || 'Collection'}</div><TileGrid>{(detail?.items || []).map((item) => { const url = item.previewUrl || item.thumbnailUrl || item.originalUrl; return <div key={item.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="aspect-[3/4] bg-black/35">{url ? <img src={url} alt={item.caption || 'Collection item'} className="h-full w-full object-cover" /> : null}</div><div className="flex items-center justify-between p-4 text-xs text-white/55"><span>#{item.sortOrder + 1}</span><Button size="sm" variant="outline" className="border-white/10 bg-white/[0.04] text-white/70">Set as cover</Button></div></div>; })}</TileGrid></div>; }
