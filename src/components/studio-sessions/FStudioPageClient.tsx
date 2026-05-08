'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Crop, FolderOpen, Grid2X2, Image, Layers3, Plus, Rows3, Trash2, UserRound } from 'lucide-react';
import CharacterManagerPanel from '@/components/characters/CharacterManagerPanel';
import FramingLibraryWorkspace, { type FramingLibraryRoute } from '@/components/studio-sessions/FramingLibraryWorkspace';
import PoseLibraryWorkspace, { type PoseLibraryRoute } from '@/components/studio-sessions/PoseLibraryWorkspace';
import CharacterSelectModal from '@/components/characters/CharacterSelectModal';
import RightPanel from '@/components/layout/RightPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useStudio } from '@/lib/context/StudioContext';
import type { CharacterSummary } from '@/lib/characters/types';
import type { StudioCollectionItemSummary, StudioCollectionSummary, StudioFramingPresetSummary, StudioPhotoSessionSummary, StudioPortfolioSummary, StudioPoseCategorySummary, StudioPoseSetSummary, StudioRunFramingPolicy, StudioSessionPoseOrientation, StudioSessionPoseSnapshot, StudioSessionRunSummary, StudioSessionShotRevisionSummary, StudioSessionShotSummary, StudioSessionShotVersionSummary } from '@/lib/studio-sessions/types';

type FStudioRoute =
  | { level: 'portfolios' }
  | { level: 'portfolio'; portfolioId: string; section?: 'sessions' | 'collections' }
  | { level: 'session'; portfolioId: string; sessionId: string }
  | { level: 'runs'; portfolioId: string; sessionId: string }
  | { level: 'run'; portfolioId: string; sessionId: string; runId: string }
  | { level: 'collection'; portfolioId: string; collectionId: string }
  | PoseLibraryRoute
  | FramingLibraryRoute;

type RunDetail = { run?: StudioSessionRunSummary; shots?: StudioSessionShotSummary[]; revisions?: StudioSessionShotRevisionSummary[]; versions?: StudioSessionShotVersionSummary[] };
type CollectionDetail = { collection: StudioCollectionSummary; items: StudioCollectionItemSummary[] } | null;
type SessionBriefDraft = Pick<StudioPhotoSessionSummary, 'name' | 'settingText' | 'lightingText' | 'vibeText' | 'outfitText' | 'hairstyleText' | 'negativePrompt' | 'notes'>;
type FramingPolicyMode = 'default' | 'single' | 'orientation';

const SESSION_BRIEF_FIELDS: Array<{ key: keyof SessionBriefDraft; label: string; multiline?: boolean; placeholder: string }> = [
  { key: 'name', label: 'Session name', placeholder: 'New photo session' },
  { key: 'settingText', label: 'Setting', multiline: true, placeholder: 'Location, scene, background, props…' },
  { key: 'lightingText', label: 'Lighting', multiline: true, placeholder: 'Studio lighting, mood, contrast, key/fill/rim…' },
  { key: 'vibeText', label: 'Vibe', multiline: true, placeholder: 'Mood, energy, expression direction…' },
  { key: 'outfitText', label: 'Outfit', multiline: true, placeholder: 'Wardrobe for this session…' },
  { key: 'hairstyleText', label: 'Hairstyle', multiline: true, placeholder: 'Hair styling for this session…' },
  { key: 'negativePrompt', label: 'Negative prompt', multiline: true, placeholder: 'Things to avoid for this session…' },
  { key: 'notes', label: 'Notes', multiline: true, placeholder: 'Internal notes…' },
];

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

function PortfolioTile({ portfolio, confirming, deleting, onDeleteClick, onConfirmDelete }: { portfolio: StudioPortfolioSummary; confirming: boolean; deleting: boolean; onDeleteClick: () => void; onConfirmDelete: () => void }) {
  return (
    <Link href={`/studio-sessions/portfolios/${portfolio.id}`} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:border-white/25 hover:bg-white/[0.06]">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={deleting}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          confirming ? onConfirmDelete() : onDeleteClick();
        }}
        className={`absolute right-3 top-3 z-10 h-8 px-2 text-xs opacity-0 backdrop-blur transition group-hover:opacity-100 focus:opacity-100 ${confirming ? 'bg-black/55 text-red-300 opacity-100 hover:bg-red-500/15 hover:text-red-200' : 'bg-black/35 text-white/60 hover:bg-black/55 hover:text-red-300'}`}
        title={confirming ? 'Confirm delete portfolio' : 'Delete portfolio'}
      >
        {confirming ? (deleting ? 'Deleting…' : 'Confirm?') : <Trash2 className="h-4 w-4" />}
      </Button>
      <div className="relative aspect-[4/3] bg-black/30">
        {portfolio.coverImageUrl || portfolio.characterPreviewUrl ? <img src={portfolio.coverImageUrl || portfolio.characterPreviewUrl || ''} alt={portfolio.characterName} className="h-full w-full object-cover transition group-hover:scale-[1.02]" /> : <div className="flex h-full items-center justify-center text-white/30"><UserRound className="h-12 w-12" /></div>}
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

function TileDeleteButton({ confirming, deleting, label, onDeleteClick, onConfirmDelete }: { confirming: boolean; deleting: boolean; label: string; onDeleteClick: () => void; onConfirmDelete: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={deleting}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        confirming ? onConfirmDelete() : onDeleteClick();
      }}
      className={`h-8 px-2 text-xs opacity-0 transition group-hover:opacity-100 focus:opacity-100 ${confirming ? 'text-red-300 opacity-100 hover:bg-red-500/10 hover:text-red-200' : 'text-white/45 hover:bg-white/[0.06] hover:text-red-300'}`}
      title={confirming ? `Confirm delete ${label}` : `Delete ${label}`}
    >
      {confirming ? (deleting ? 'Deleting…' : 'Confirm?') : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}

function SessionTile({ session, href, confirming, deleting, onDeleteClick, onConfirmDelete }: { session: StudioPhotoSessionSummary; href: string; confirming: boolean; deleting: boolean; onDeleteClick: () => void; onConfirmDelete: () => void }) {
  return (
    <Link href={href} className="group relative flex min-h-[180px] flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-white/25 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-white/55"><Rows3 className="h-5 w-5" /></div>
        <TileDeleteButton confirming={confirming} deleting={deleting} label="session" onDeleteClick={onDeleteClick} onConfirmDelete={onConfirmDelete} />
      </div>
      <div>
        <div className="truncate text-base font-semibold text-white">{session.name}</div>
        <div className="mt-1 line-clamp-2 text-xs text-white/50">{[session.settingText, session.vibeText, `${session.runCount} runs`].filter(Boolean).join(' · ')}</div>
      </div>
    </Link>
  );
}

function RunTile({ run, href, confirming, deleting, onDeleteClick, onConfirmDelete }: { run: StudioSessionRunSummary; href: string; confirming: boolean; deleting: boolean; onDeleteClick: () => void; onConfirmDelete: () => void }) {
  return (
    <Link href={href} className="group relative flex min-h-[180px] flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-white/25 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-white/55"><Layers3 className="h-5 w-5" /></div>
        <TileDeleteButton confirming={confirming} deleting={deleting} label="run" onDeleteClick={onDeleteClick} onConfirmDelete={onConfirmDelete} />
      </div>
      <div>
        <div className="truncate text-base font-semibold text-white">{run.name || run.poseSetId || 'Run'}</div>
        <div className="mt-1 line-clamp-2 text-xs text-white/50">{`${run.count} shots · ${run.status}`}</div>
      </div>
    </Link>
  );
}

function Sidebar({ route, portfolioId, sessionId, collapsed, hydrated, onToggle }: { route: FStudioRoute; portfolioId?: string | null; sessionId?: string | null; collapsed: boolean; hydrated: boolean; onToggle: () => void }) {
  const items = [
    { key: 'portfolios', label: 'Portfolios', icon: Grid2X2, href: '/studio-sessions', visible: true, active: route.level === 'portfolios' },
    { key: 'pose-library', label: 'Pose Library', icon: Image, href: '/studio-sessions/pose-library', visible: true, active: route.level === 'poseLibrary' || route.level === 'poseLibraryCategory' || route.level === 'poseLibraryPose' },
    { key: 'framing-library', label: 'Framing Library', icon: Crop, href: '/studio-sessions/framing-library', visible: true, active: route.level === 'framingLibrary' },
    { key: 'sessions', label: 'Sessions', icon: Rows3, href: portfolioId ? `/studio-sessions/portfolios/${portfolioId}` : '#', visible: Boolean(portfolioId), active: (route.level === 'portfolio' && route.section !== 'collections') || route.level === 'session' },
    { key: 'runs', label: 'Runs', icon: Layers3, href: portfolioId && sessionId ? `/studio-sessions/portfolios/${portfolioId}/sessions/${sessionId}/runs` : '#', visible: Boolean(portfolioId && sessionId), active: route.level === 'runs' || route.level === 'run' },
    { key: 'collections', label: 'Collections', icon: FolderOpen, href: portfolioId ? `/studio-sessions/portfolios/${portfolioId}/collections` : '#', visible: Boolean(portfolioId), active: route.level === 'collection' || (route.level === 'portfolio' && route.section === 'collections') },
  ];
  return (
    <aside className={`${collapsed ? 'w-[76px]' : 'w-64'} shrink-0 border-r border-white/10 bg-[#101014] p-3 ${hydrated ? 'transition-all' : ''}`}>
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

function createSessionBriefDraft(session: StudioPhotoSessionSummary): SessionBriefDraft {
  return {
    name: session.name || '',
    settingText: session.settingText || '',
    lightingText: session.lightingText || '',
    vibeText: session.vibeText || '',
    outfitText: session.outfitText || '',
    hairstyleText: session.hairstyleText || '',
    negativePrompt: session.negativePrompt || '',
    notes: session.notes || '',
  };
}

function SessionBriefEditor({ session, onSave, onOpenRuns }: { session: StudioPhotoSessionSummary | null; onSave: (sessionId: string, draft: SessionBriefDraft) => Promise<void>; onOpenRuns: () => void }) {
  const [draft, setDraft] = useState<SessionBriefDraft | null>(session ? createSessionBriefDraft(session) : null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(session ? createSessionBriefDraft(session) : null);
  }, [session]);

  const cleanDraft = session ? createSessionBriefDraft(session) : null;
  const dirty = Boolean(draft && cleanDraft && JSON.stringify(draft) !== JSON.stringify(cleanDraft));

  if (!session || !draft) return <EmptyState title="Session not found" description="This session could not be loaded." />;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await onSave(session.id, draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-white/10 bg-white/[0.035] text-white">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Session brief</div>
            <div className="mt-1 text-sm text-white/45">Editable until dedicated libraries/pickers are added for these fields.</div>
          </div>
          <Button type="button" onClick={() => void save()} disabled={!dirty || saving} className="bg-blue-500 text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {SESSION_BRIEF_FIELDS.map((field) => (
            <label key={field.key} className={`${field.key === 'notes' || field.key === 'negativePrompt' ? 'md:col-span-2' : ''} block rounded-2xl border border-white/10 bg-black/20 p-4`}>
              <div className="text-xs uppercase tracking-[0.16em] text-white/35">{field.label}</div>
              {field.multiline ? (
                <textarea
                  value={draft[field.key]}
                  onChange={(event) => setDraft((current) => current ? { ...current, [field.key]: event.target.value } : current)}
                  placeholder={field.placeholder}
                  rows={field.key === 'notes' || field.key === 'negativePrompt' ? 4 : 3}
                  className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-blue-400/60 focus:bg-white/[0.06]"
                />
              ) : (
                <Input
                  value={draft[field.key]}
                  onChange={(event) => setDraft((current) => current ? { ...current, [field.key]: event.target.value } : current)}
                  placeholder={field.placeholder}
                  className="mt-2 border-white/10 bg-white/[0.04] text-white placeholder:text-white/25 focus:border-blue-400/60"
                />
              )}
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={onOpenRuns} className="bg-blue-500 text-white hover:bg-blue-400">Open runs</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Header({ breadcrumbs, jobsPanelOpen, activeJobsCount, onToggleJobsPanel, onOpenCharacterManager }: { breadcrumbs: Array<{ label: string; href?: string }>; jobsPanelOpen: boolean; activeJobsCount: number; onToggleJobsPanel: () => void; onOpenCharacterManager: () => void }) {
  return (
    <header className="border-b border-white/10 bg-[#0f0f11]/95 px-8 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-semibold tracking-tight text-white">F-Studio</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/45">
            {breadcrumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">{index > 0 ? <span className="text-white/25">→</span> : null}{crumb.href ? <Link href={crumb.href} className="text-white/65 hover:text-white">{crumb.label}</Link> : <span className="text-white">{crumb.label}</span>}</span>)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="group relative">
            <Button type="button" variant="outline" size="icon" onClick={onOpenCharacterManager} aria-label="Characters" title="Characters" className="h-10 w-10 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">
              <UserRound className="h-4 w-4" />
            </Button>
            <div className="pointer-events-none absolute right-0 top-full z-30 mt-2 rounded-lg border border-white/10 bg-black/85 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-xl backdrop-blur transition group-hover:opacity-100 group-focus-within:opacity-100">
              Characters
            </div>
          </div>
          <div className="group relative">
            <Button type="button" variant="outline" size="icon" onClick={onToggleJobsPanel} aria-label="Jobs" title="Jobs" className={`relative h-10 w-10 border-white/10 text-white hover:bg-white/[0.08] ${jobsPanelOpen ? 'bg-blue-500/20' : 'bg-white/[0.04]'}`}>
              <Rows3 className="h-4 w-4" />
              {activeJobsCount > 0 ? <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-4 text-white">{activeJobsCount}</span> : null}
            </Button>
            <div className="pointer-events-none absolute right-0 top-full z-30 mt-2 rounded-lg border border-white/10 bg-black/85 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-xl backdrop-blur transition group-hover:opacity-100 group-focus-within:opacity-100">
              Jobs{activeJobsCount > 0 ? ` · ${activeJobsCount}` : ''}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function FStudioPageClient({ route }: { route: FStudioRoute }) {
  const router = useRouter();
  const { activeWorkspaceId, jobs } = useStudio();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarHydrated, setSidebarHydrated] = useState(false);
  const [jobsPanelOpen, setJobsPanelOpen] = useState(false);
  const [portfolios, setPortfolios] = useState<StudioPortfolioSummary[]>([]);
  const [sessions, setSessions] = useState<StudioPhotoSessionSummary[]>([]);
  const [collections, setCollections] = useState<StudioCollectionSummary[]>([]);
  const [runs, setRuns] = useState<StudioSessionRunSummary[]>([]);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [collectionDetail, setCollectionDetail] = useState<CollectionDetail>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [poseSets, setPoseSets] = useState<StudioPoseSetSummary[]>([]);
  const [poseCategories, setPoseCategories] = useState<StudioPoseCategorySummary[]>([]);
  const [framingPresets, setFramingPresets] = useState<StudioFramingPresetSummary[]>([]);
  const [showCharacterManager, setShowCharacterManager] = useState(false);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedPoseSetId, setSelectedPoseSetId] = useState('');
  const [newRunCount, setNewRunCount] = useState(5);
  const [framingPolicyMode, setFramingPolicyMode] = useState<FramingPolicyMode>('default');
  const [fallbackFramingPresetId, setFallbackFramingPresetId] = useState('');
  const [framingPresetByOrientation, setFramingPresetByOrientation] = useState<Record<StudioSessionPoseOrientation, string>>({ portrait: '', landscape: '', square: '' });
  const [confirmingDeletePortfolioId, setConfirmingDeletePortfolioId] = useState<string | null>(null);
  const [deletingPortfolioId, setDeletingPortfolioId] = useState<string | null>(null);
  const [confirmingDeleteSessionId, setConfirmingDeleteSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [confirmingDeleteRunId, setConfirmingDeleteRunId] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portfolioId = 'portfolioId' in route ? route.portfolioId : null;
  const sessionId = 'sessionId' in route ? route.sessionId : null;
  const selectedPortfolio = useMemo(() => portfolios.find((portfolio) => portfolio.id === portfolioId) ?? null, [portfolioId, portfolios]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === sessionId) ?? null, [sessionId, sessions]);
  const selectedRun = useMemo(() => runs.find((run) => route.level === 'run' && run.id === route.runId) ?? runDetail?.run ?? null, [route, runDetail?.run, runs]);
  const activeJobsCount = useMemo(() => jobs.filter((job) => job.workspaceId === activeWorkspaceId && ['queueing_up', 'queued', 'processing', 'finalizing'].includes(job.status)).length, [activeWorkspaceId, jobs]);

  useEffect(() => {
    setCollapsed(localStorage.getItem('f-studio-sidebar-collapsed') === '1');
    setJobsPanelOpen(localStorage.getItem('f-studio-jobs-panel-open') === '1');
    requestAnimationFrame(() => setSidebarHydrated(true));
  }, []);
  const toggleCollapsed = () => setCollapsed((next) => { localStorage.setItem('f-studio-sidebar-collapsed', next ? '0' : '1'); return !next; });
  const toggleJobsPanel = () => setJobsPanelOpen((next) => { localStorage.setItem('f-studio-jobs-panel-open', next ? '0' : '1'); return !next; });

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
        if (!activeWorkspaceId) return;
        const [poseData, poseCategoryData, framingData] = await Promise.all([
          fetchJson(`/api/studio/pose-sets?workspaceId=${encodeURIComponent(activeWorkspaceId)}`, 'Failed to fetch pose sets'),
          fetchJson(`/api/studio/pose-library/categories?workspaceId=${encodeURIComponent(activeWorkspaceId)}`, 'Failed to fetch pose categories'),
          fetchJson(`/api/studio/framing-presets?workspaceId=${encodeURIComponent(activeWorkspaceId)}`, 'Failed to fetch framing presets'),
        ]);
        if (!cancelled) {
          setPoseSets(Array.isArray(poseData.poseSets) ? poseData.poseSets : []);
          setPoseCategories(Array.isArray(poseCategoryData.categories) ? poseCategoryData.categories : []);
          setFramingPresets(Array.isArray(framingData.presets) ? framingData.presets : []);
        }
      } catch (err) { if (!cancelled) setError(toErrorMessage(err, 'Failed to load F-Studio')); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, fetchJson, refreshPortfolios]);

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
    if (route.level === 'poseLibrary' || route.level === 'poseLibraryCategory' || route.level === 'poseLibraryPose') {
      const crumbs: Array<{ label: string; href?: string }> = [{ label: 'Pose Library', href: route.level === 'poseLibrary' && route.view !== 'all' ? undefined : '/studio-sessions/pose-library' }];
      if (route.level === 'poseLibrary' && route.view === 'all') crumbs.push({ label: 'All poses' });
      if (route.level === 'poseLibraryCategory' || route.level === 'poseLibraryPose') {
        const categoryName = poseCategories.find((category) => category.id === route.categoryId)?.name || 'Category';
        crumbs.push({ label: categoryName, href: route.level === 'poseLibraryCategory' ? undefined : `/studio-sessions/pose-library/categories/${route.categoryId}` });
      }
      if (route.level === 'poseLibraryPose') crumbs.push({ label: 'Pose' });
      return crumbs;
    }
    if (route.level === 'framingLibrary') return [{ label: 'Framing Library' }];
    const crumbs: Array<{ label: string; href?: string }> = [{ label: 'Portfolios', href: route.level === 'portfolios' ? undefined : '/studio-sessions' }];
    if (selectedPortfolio && portfolioId) crumbs.push({ label: characterMeta(selectedPortfolio), href: route.level === 'portfolio' ? undefined : `/studio-sessions/portfolios/${portfolioId}` });
    if (route.level === 'session' || route.level === 'runs' || route.level === 'run') crumbs.push({ label: 'Sessions', href: portfolioId ? `/studio-sessions/portfolios/${portfolioId}` : undefined });
    if ((route.level === 'session' || route.level === 'runs' || route.level === 'run') && selectedSession) crumbs.push({ label: selectedSession.name, href: route.level === 'session' ? undefined : `/studio-sessions/portfolios/${portfolioId}/sessions/${selectedSession.id}` });
    if (route.level === 'runs' || route.level === 'run') crumbs.push({ label: 'Runs', href: route.level === 'runs' ? undefined : `/studio-sessions/portfolios/${portfolioId}/sessions/${sessionId}/runs` });
    if (route.level === 'run' && selectedRun) crumbs.push({ label: selectedRun.name || 'Run' });
    if ((route.level === 'collection' || (route.level === 'portfolio' && route.section === 'collections')) && portfolioId) crumbs.push({ label: 'Collections', href: route.level === 'collection' ? `/studio-sessions/portfolios/${portfolioId}/collections` : undefined });
    if (route.level === 'collection' && collectionDetail?.collection) crumbs.push({ label: collectionDetail.collection.name });
    return crumbs;
  }, [collectionDetail?.collection, portfolioId, poseCategories, route, selectedPortfolio, selectedRun, selectedSession, sessionId]);

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
  function buildRunFramingPolicy(): StudioRunFramingPolicy {
    if (framingPolicyMode === 'default') return { fallbackPresetId: null, presetByOrientation: {} };
    if (framingPolicyMode === 'single') return { fallbackPresetId: fallbackFramingPresetId || null, presetByOrientation: {} };
    return {
      fallbackPresetId: fallbackFramingPresetId || null,
      presetByOrientation: {
        portrait: framingPresetByOrientation.portrait || null,
        landscape: framingPresetByOrientation.landscape || null,
        square: framingPresetByOrientation.square || null,
      },
    };
  }

  async function createRun() {
    if (!portfolioId || !sessionId || !selectedPoseSetId) return;
    const pose = poseSets.find((item) => item.id === selectedPoseSetId);
    const framingPolicy = buildRunFramingPolicy();
    const response = await fetch(`/api/studio/sessions/${sessionId}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName || pose?.name || 'New run', poseSetId: selectedPoseSetId, count: newRunCount, generationSettings: { framingPolicy } }) });
    const data = await response.json();
    if (data?.success) router.push(`/studio-sessions/portfolios/${portfolioId}/sessions/${sessionId}/runs/${data.run.id}`); else setError(data?.error || 'Failed to create run');
  }

  async function saveSessionBrief(id: string, draft: SessionBriefDraft) {
    setError(null);
    try {
      const response = await fetch(`/api/studio/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save session brief');
      if (data.session) {
        setSessions((current) => current.map((session) => session.id === id ? data.session : session));
      }
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to save session brief'));
      throw err;
    }
  }

  async function deletePortfolio(id: string) {
    setDeletingPortfolioId(id); setError(null);
    try {
      const response = await fetch(`/api/studio/portfolios/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to delete portfolio');
      setPortfolios((current) => current.filter((portfolio) => portfolio.id !== id));
      setConfirmingDeletePortfolioId(null);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to delete portfolio'));
    } finally {
      setDeletingPortfolioId(null);
    }
  }

  async function deleteSession(id: string) {
    setDeletingSessionId(id); setError(null);
    try {
      const response = await fetch(`/api/studio/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to delete session');
      setSessions((current) => current.filter((session) => session.id !== id));
      setConfirmingDeleteSessionId(null);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to delete session'));
    } finally {
      setDeletingSessionId(null);
    }
  }

  async function deleteRun(id: string) {
    setDeletingRunId(id); setError(null);
    try {
      const response = await fetch(`/api/studio/runs/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to delete run');
      setRuns((current) => current.filter((run) => run.id !== id));
      setConfirmingDeleteRunId(null);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to delete run'));
    } finally {
      setDeletingRunId(null);
    }
  }

  function renderCanvas() {
    if (!activeWorkspaceId) return <EmptyState title="No workspace selected" description="Select or create a workspace before using F-Studio." />;
    if (route.level === 'poseLibrary' || route.level === 'poseLibraryCategory' || route.level === 'poseLibraryPose') return <PoseLibraryWorkspace route={route} />;
    if (route.level === 'framingLibrary') return <FramingLibraryWorkspace />;
    if (loading) return <LoadingGrid />;
    if (route.level === 'portfolios') return <TileGrid><AddTile label="New portfolio" onClick={() => setShowCreatePortfolio(true)} />{portfolios.map((portfolio) => <PortfolioTile key={portfolio.id} portfolio={portfolio} confirming={confirmingDeletePortfolioId === portfolio.id} deleting={deletingPortfolioId === portfolio.id} onDeleteClick={() => setConfirmingDeletePortfolioId(portfolio.id)} onConfirmDelete={() => void deletePortfolio(portfolio.id)} />)}{portfolios.length === 0 ? <EmptyTile title="No portfolios yet" description="Create the first character portfolio to start building sessions and collections." /> : null}</TileGrid>;
    if (route.level === 'portfolio' && route.section === 'collections') return <TileGrid><AddTile label="New collection" onClick={() => { setNewName(''); setShowCreateCollection(true); }} />{collections.map((collection) => <SimpleTile key={collection.id} title={collection.name} subtitle={`${collection.itemCount} photos`} href={`/studio-sessions/portfolios/${portfolioId}/collections/${collection.id}`} icon={<Image className="h-5 w-5" />} />)}{collections.length === 0 ? <EmptyTile title="No collections yet" description="Create a collection, then add reviewed run images into a final set." /> : null}</TileGrid>;
    if (route.level === 'portfolio') return <TileGrid><AddTile label="New session" onClick={() => { setNewName(''); setShowCreateSession(true); }} />{sessions.map((session) => <SessionTile key={session.id} session={session} href={`/studio-sessions/portfolios/${portfolioId}/sessions/${session.id}`} confirming={confirmingDeleteSessionId === session.id} deleting={deletingSessionId === session.id} onDeleteClick={() => setConfirmingDeleteSessionId(session.id)} onConfirmDelete={() => void deleteSession(session.id)} />)}{sessions.length === 0 ? <EmptyTile title="No sessions yet" description="Create a photo session to define setting, vibe, outfit, and runs." /> : null}</TileGrid>;
    if (route.level === 'session') return <SessionBriefEditor session={selectedSession} onSave={saveSessionBrief} onOpenRuns={() => router.push(`/studio-sessions/portfolios/${portfolioId}/sessions/${sessionId}/runs`)} />;
    if (route.level === 'runs') return <TileGrid><AddTile label="New run" onClick={() => { setNewName(''); setSelectedPoseSetId(poseSets[0]?.id || ''); setNewRunCount(5); setFramingPolicyMode('default'); setFallbackFramingPresetId(''); setFramingPresetByOrientation({ portrait: '', landscape: '', square: '' }); setShowCreateRun(true); }} />{runs.map((run) => <RunTile key={run.id} run={run} href={`/studio-sessions/portfolios/${portfolioId}/sessions/${sessionId}/runs/${run.id}`} confirming={confirmingDeleteRunId === run.id} deleting={deletingRunId === run.id} onDeleteClick={() => setConfirmingDeleteRunId(run.id)} onConfirmDelete={() => void deleteRun(run.id)} />)}{runs.length === 0 ? <EmptyTile title="No runs yet" description="Create a run by choosing exactly one pose set for this session." /> : null}</TileGrid>;
    if (route.level === 'run') return <RunWorkspace detail={runDetail} framingPresets={framingPresets} />;
    if (route.level === 'collection') return <CollectionWorkspace detail={collectionDetail} portfolioId={portfolioId} onCoverSet={() => { refreshPortfolios(); if (portfolioId) refreshPortfolioDetail(portfolioId); }} />;
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#0b0b0d] text-white">
      <Sidebar route={route} portfolioId={portfolioId} sessionId={sessionId} collapsed={collapsed} hydrated={sidebarHydrated} onToggle={toggleCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header breadcrumbs={breadcrumbs} jobsPanelOpen={jobsPanelOpen} activeJobsCount={activeJobsCount} onToggleJobsPanel={toggleJobsPanel} onOpenCharacterManager={() => setShowCharacterManager(true)} />
        <main className="min-w-0 flex-1 overflow-auto p-8">
          {error ? <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
          {renderCanvas()}
        </main>
      </div>
      <div className={`fixed inset-y-0 right-0 z-40 flex transition-transform duration-300 ease-out ${jobsPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="relative h-full w-[340px] max-w-[88vw] border-l border-white/10 bg-[#101014] shadow-2xl shadow-black/50">
          {jobsPanelOpen ? (
            <Button type="button" variant="outline" size="sm" onClick={toggleJobsPanel} className="absolute right-full top-5 mr-3 border-white/10 bg-[#101014] text-white hover:bg-white/[0.08]">
              <ChevronRight className="mr-1 h-4 w-4" />
              Hide
            </Button>
          ) : null}
          <RightPanel />
        </div>
      </div>
      <Dialog open={showCharacterManager} onOpenChange={setShowCharacterManager}>
        <DialogContent className="flex h-[94vh] w-[96vw] max-w-[1600px] flex-col gap-0 overflow-hidden border-white/10 bg-[#101014] p-0 text-white">
          <DialogHeader className="border-b border-white/10 px-5 py-4 pr-14 text-left">
            <DialogTitle>Character Manager</DialogTitle>
            <DialogDescription className="text-white/50">Manage character canon without leaving F-Studio.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5">
            <CharacterManagerPanel />
          </div>
        </DialogContent>
      </Dialog>
      <CharacterSelectModal open={showCreatePortfolio} characters={characters} loading={false} selectedCharacterId={null} onOpenChange={setShowCreatePortfolio} onSelect={createPortfolio} />
      <NameDialog open={showCreateSession} title="New session" value={newName} onChange={setNewName} onOpenChange={setShowCreateSession} onSubmit={createSession} />
      <NameDialog open={showCreateCollection} title="New collection" value={newName} onChange={setNewName} onOpenChange={setShowCreateCollection} onSubmit={createCollection} />
      <Dialog open={showCreateRun} onOpenChange={setShowCreateRun}><DialogContent className="max-w-3xl border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle>New run</DialogTitle><DialogDescription className="text-white/50">Choose one pose set, shot count, and the run-level framing policy.</DialogDescription></DialogHeader><Input value={newName} onChange={(event) => setNewName(event.target.value)} className="border-white/10 bg-black/30 text-white" placeholder="Run name" /><select value={selectedPoseSetId} onChange={(event) => setSelectedPoseSetId(event.target.value)} className="h-10 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white">{poseSets.map((poseSet) => <option key={poseSet.id} value={poseSet.id}>{poseSet.name}</option>)}</select><label className="space-y-1 text-sm text-white/60"><span>Shot count</span><Input type="number" min={1} max={50} value={newRunCount} onChange={(event) => setNewRunCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} className="border-white/10 bg-black/30 text-white" /></label><RunFramingPolicySelector mode={framingPolicyMode} onModeChange={setFramingPolicyMode} presets={framingPresets} fallbackPresetId={fallbackFramingPresetId} onFallbackChange={setFallbackFramingPresetId} byOrientation={framingPresetByOrientation} onOrientationPresetChange={(orientation, presetId) => setFramingPresetByOrientation((current) => ({ ...current, [orientation]: presetId }))} /><Button onClick={createRun} disabled={!selectedPoseSetId || (framingPolicyMode === 'single' && !fallbackFramingPresetId)} className="bg-blue-500 text-white hover:bg-blue-400">Create run</Button></DialogContent></Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) { return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</div><div className="mt-2 text-sm text-white/75">{value || 'Not set'}</div></div>; }

function presetTitle(presets: StudioFramingPresetSummary[], id: string | null | undefined) {
  if (!id) return '';
  return presets.find((preset) => preset.id === id)?.title || id.slice(0, 8);
}

function formatRunFramingPolicy(value: unknown, presets: StudioFramingPresetSummary[]) {
  const policy = value && typeof value === 'object' ? value as Partial<StudioRunFramingPolicy> : {};
  const byOrientation = policy.presetByOrientation && typeof policy.presetByOrientation === 'object' ? policy.presetByOrientation : {};
  const orientationParts = (['portrait', 'landscape', 'square'] as const)
    .map((orientation) => byOrientation[orientation] ? `${orientation}: ${presetTitle(presets, byOrientation[orientation])}` : '')
    .filter(Boolean);
  if (orientationParts.length) {
    const fallback = policy.fallbackPresetId ? `; fallback: ${presetTitle(presets, policy.fallbackPresetId)}` : '; fallback: default centered';
    return `By orientation — ${orientationParts.join(', ')}${fallback}`;
  }
  if (policy.fallbackPresetId) return `Single preset — ${presetTitle(presets, policy.fallbackPresetId)}`;
  return 'Default centered';
}

function RunFramingPolicySelector({ mode, onModeChange, presets, fallbackPresetId, onFallbackChange, byOrientation, onOrientationPresetChange }: { mode: FramingPolicyMode; onModeChange: (mode: FramingPolicyMode) => void; presets: StudioFramingPresetSummary[]; fallbackPresetId: string; onFallbackChange: (id: string) => void; byOrientation: Record<StudioSessionPoseOrientation, string>; onOrientationPresetChange: (orientation: StudioSessionPoseOrientation, presetId: string) => void }) {
  const orientations: StudioSessionPoseOrientation[] = ['portrait', 'landscape', 'square'];
  return <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4"><div><div className="text-sm font-semibold text-white">Framing policy</div><div className="mt-1 text-xs text-white/45">Resolution order: orientation-specific preset → fallback preset → default centered.</div></div><div className="grid gap-2 sm:grid-cols-3">{([{ value: 'default', label: 'Default centered' }, { value: 'single', label: 'Single preset' }, { value: 'orientation', label: 'By orientation' }] as Array<{ value: FramingPolicyMode; label: string }>).map((item) => <button key={item.value} type="button" onClick={() => onModeChange(item.value)} className={`rounded-xl border px-3 py-2 text-left text-sm transition ${mode === item.value ? 'border-blue-400/60 bg-blue-500/15 text-blue-100' : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]'}`}>{item.label}</button>)}</div>{mode !== 'default' ? <label className="block space-y-1 text-sm text-white/60"><span>{mode === 'single' ? 'Preset for all orientations' : 'Fallback preset'}</span><select value={fallbackPresetId} onChange={(event) => onFallbackChange(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="">Default centered</option>{presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.title} · {preset.orientation}</option>)}</select></label> : null}{mode === 'orientation' ? <div className="grid gap-3 sm:grid-cols-3">{orientations.map((orientation) => <label key={orientation} className="block space-y-1 text-sm text-white/60"><span>{orientation}</span><select value={byOrientation[orientation]} onChange={(event) => onOrientationPresetChange(orientation, event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"><option value="">Use fallback</option>{presets.filter((preset) => preset.orientation === orientation).map((preset) => <option key={preset.id} value={preset.id}>{preset.title}</option>)}</select></label>)}</div> : null}{presets.length === 0 ? <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">No framing presets yet. Default centered remains available.</div> : null}</div>;
}

function EmptyState({ title, description }: { title: string; description: string }) { return <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-white"><div className="text-lg font-semibold">{title}</div><div className="mt-2 max-w-xl text-sm text-white/50">{description}</div></div>; }
function EmptyTile({ title, description }: { title: string; description: string }) { return <div className="flex min-h-[220px] flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.025] p-6 text-white"><div className="text-base font-semibold">{title}</div><div className="mt-2 text-sm text-white/45">{description}</div></div>; }
function LoadingGrid() { return <TileGrid>{Array.from({ length: 6 }).map((_, index) => <div key={index} className="min-h-[220px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.035]" />)}</TileGrid>; }
function NameDialog({ open, title, value, onChange, onOpenChange, onSubmit }: { open: boolean; title: string; value: string; onChange: (value: string) => void; onOpenChange: (open: boolean) => void; onSubmit: () => void }) { return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><Input value={value} onChange={(event) => onChange(event.target.value)} className="border-white/10 bg-black/30 text-white" placeholder="Name" /><Button onClick={onSubmit} className="bg-blue-500 text-white hover:bg-blue-400">Create</Button></DialogContent></Dialog>; }
function RunWorkspace({ detail, framingPresets }: { detail: RunDetail | null; framingPresets: StudioFramingPresetSummary[] }) {
  const [shots, setShots] = useState<StudioSessionShotSummary[]>([]);
  const [revisions, setRevisions] = useState<StudioSessionShotRevisionSummary[]>([]);
  const [versions, setVersions] = useState<StudioSessionShotVersionSummary[]>([]);
  const [runOverride, setRunOverride] = useState<StudioSessionRunSummary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlStrengthDraft, setControlStrengthDraft] = useState('1');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [reviewingVersionId, setReviewingVersionId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [posePickerShotId, setPosePickerShotId] = useState<string | null>(null);
  const [posePickerPoses, setPosePickerPoses] = useState<StudioSessionPoseSnapshot[]>([]);
  const [posePickerLoading, setPosePickerLoading] = useState(false);
  const [posePickerError, setPosePickerError] = useState<string | null>(null);
  const [savingPoseId, setSavingPoseId] = useState<string | null>(null);

  useEffect(() => { setShots(detail?.shots || []); }, [detail?.shots]);
  useEffect(() => { setRevisions(detail?.revisions || []); }, [detail?.revisions]);
  useEffect(() => { setVersions(detail?.versions || []); }, [detail?.versions]);
  useEffect(() => { setRunOverride(null); }, [detail?.run]);

  const run = runOverride ?? detail?.run ?? null;
  const runSettings = run?.runSettings || {};
  const resolution = run?.resolutionPolicy || {};
  const snapshot = run?.templateSnapshot as Record<string, any> | undefined;
  const poseSetName = typeof snapshot?.poseSetName === 'string' && snapshot.poseSetName.trim() ? snapshot.poseSetName : run?.poseSetId;
  const framingPolicyLabel = formatRunFramingPolicy(runSettings.framingPolicy, framingPresets);
  const currentControlStrength = typeof runSettings.controlnet_strength === 'number' ? runSettings.controlnet_strength : 1;

  useEffect(() => { setControlStrengthDraft(String(currentControlStrength)); }, [currentControlStrength, run?.id]);

  const revisionsByShotId = useMemo(() => new Map(revisions.map((revision) => [revision.shotId, revision])), [revisions]);
  const pickerShot = useMemo(() => shots.find((shot) => shot.id === posePickerShotId) ?? null, [posePickerShotId, shots]);
  const pickerRevision = posePickerShotId ? revisionsByShotId.get(posePickerShotId) ?? null : null;

  const reviewStates: Array<{ value: StudioSessionShotVersionSummary['reviewState']; label: string }> = [
    { value: 'hero', label: 'Hero' },
    { value: 'pick', label: 'Pick' },
    { value: 'maybe', label: 'Maybe' },
    { value: 'reject', label: 'Reject' },
    { value: 'needs_retry', label: 'Retry' },
  ];

  const openPosePicker = async (shotId: string) => {
    setPosePickerShotId(shotId);
    setPosePickerPoses([]);
    setPosePickerError(null);
    setPosePickerLoading(true);
    try {
      const response = await fetch(`/api/studio/shots/${encodeURIComponent(shotId)}/poses`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to load poses');
      setPosePickerPoses(Array.isArray(data.poses) ? data.poses : []);
    } catch (error) {
      setPosePickerError(toErrorMessage(error, 'Failed to load poses'));
    } finally {
      setPosePickerLoading(false);
    }
  };

  const choosePose = async (poseId: string) => {
    if (!posePickerShotId) return;
    setSavingPoseId(poseId);
    setPosePickerError(null);
    try {
      const response = await fetch(`/api/studio/shots/${encodeURIComponent(posePickerShotId)}/poses`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to choose pose');
      const revision = data.revision as StudioSessionShotRevisionSummary;
      setRevisions((current) => [...current.filter((item) => item.id !== revision.id), revision]);
      setShots((current) => current.map((shot) => shot.id === posePickerShotId ? { ...shot, currentRevisionId: revision.id, status: 'assigned' } : shot));
      setPosePickerShotId(null);
      setPosePickerPoses([]);
    } catch (error) {
      setPosePickerError(toErrorMessage(error, 'Failed to choose pose'));
    } finally {
      setSavingPoseId(null);
    }
  };

  const saveRunSettings = async () => {
    if (!run) return;
    const parsed = Number(controlStrengthDraft);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) {
      setSettingsError('ControlNet strength must be between 0 and 2.');
      return;
    }
    setSavingSettings(true);
    setSettingsError(null);
    try {
      const response = await fetch(`/api/studio/runs/${encodeURIComponent(run.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationSettings: { ...runSettings, controlnet_strength: parsed } }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save run settings');
      setRunOverride(data.run as StudioSessionRunSummary);
    } catch (error) {
      setSettingsError(toErrorMessage(error, 'Failed to save run settings'));
    } finally {
      setSavingSettings(false);
    }
  };

  const reviewVersion = async (versionId: string, reviewState: StudioSessionShotVersionSummary['reviewState']) => {
    setReviewingVersionId(versionId);
    try {
      const response = await fetch(`/api/studio/versions/${encodeURIComponent(versionId)}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewState }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to review version');
      setVersions((current) => current.map((version) => version.id === versionId ? data.version : version));
    } finally {
      setReviewingVersionId(null);
    }
  };

  const launchRun = async () => {
    if (!run || launching) return;
    setLaunching(true);
    setLaunchMessage(null);
    setLaunchError(null);
    try {
      const response = await fetch(`/api/studio/runs/${encodeURIComponent(run.id)}/launch`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to launch run');
      const launchedCount = Array.isArray(data.launched) ? data.launched.length : 0;
      const skippedCount = Array.isArray(data.skippedShotIds) ? data.skippedShotIds.length : 0;
      setLaunchMessage(`Launched ${launchedCount} job${launchedCount === 1 ? '' : 's'}${skippedCount > 0 ? `, skipped ${skippedCount}` : ''}. Open Jobs to track progress.`);
    } catch (error) {
      setLaunchError(toErrorMessage(error, 'Failed to launch run'));
    } finally {
      setLaunching(false);
    }
  };

  const renderPoseFrame = (shot: StudioSessionShotSummary, revision?: StudioSessionShotRevisionSummary) => {
    const poseImage = revision?.poseSnapshot.primaryPreviewUrl || revision?.poseSnapshot.openPose?.imageUrl || null;
    const poseName = revision?.poseSnapshot.name || 'Pose pending';
    if (poseImage) return <img src={poseImage} alt={poseName} className="h-full w-full object-contain" />;
    return <div className="flex h-full items-center justify-center px-4 text-center text-sm font-medium text-white/70">{poseName}</div>;
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xl font-semibold">{run?.name || 'Run'}</div><div className="mt-1 text-sm text-white/45">{run ? `${run.count} shots · ${run.status}` : 'Loading run details…'}</div></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setSettingsOpen(true)} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">Run settings</Button><Button type="button" onClick={() => void launchRun()} disabled={!run || launching} className="bg-blue-500 text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50">{launching ? 'Launching…' : 'Launch run'}</Button></div></div>
    {launchMessage ? <div className="rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{launchMessage}</div> : null}
    {launchError ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{launchError}</div> : null}

    <TileGrid>{shots.map((shot) => { const revision = revisionsByShotId.get(shot.id); return <div key={shot.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="aspect-[3/4] bg-black/35">{renderPoseFrame(shot, revision)}</div><div className="space-y-3 p-4"><div><div className="text-sm font-semibold text-white">{shot.label}</div><div className="mt-1 text-xs text-white/50">{shot.category}{revision ? ` · ${revision.poseSnapshot.name}` : ' · pose pending'}</div></div><div className="flex items-center justify-between gap-2"><span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/55">{shot.status}</span><Button type="button" size="sm" variant="outline" onClick={() => void openPosePicker(shot.id)} className="h-8 border-white/10 bg-white/[0.04] px-3 text-xs text-white/75 hover:bg-white/[0.08]">{revision ? 'Change pose' : 'Choose pose'}</Button></div></div></div>; })}{shots.length === 0 ? <EmptyTile title="No draft shots yet" description="Create a run with shot slots before launching." /> : null}</TileGrid>

    <TileGrid>{versions.map((version) => { const url = version.previewUrl || version.thumbnailUrl || version.originalUrl; const revision = revisions.find((item) => item.id === version.revisionId) ?? revisionsByShotId.get(version.shotId); return <div key={version.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="aspect-[3/4] bg-black/35">{url ? <img src={url} alt="Version" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-white/35">No preview</div>}</div><div className="space-y-3 p-4"><div className="text-xs text-white/55">v{version.versionNumber} · {version.reviewState}{revision ? ` · ${revision.poseSnapshot.name}` : ''}</div><div className="flex flex-wrap gap-1.5">{reviewStates.map((state) => <Button key={state.value} size="sm" variant="outline" disabled={reviewingVersionId === version.id} onClick={() => reviewVersion(version.id, state.value)} className={`h-7 border-white/10 px-2 text-[11px] ${version.reviewState === state.value ? 'bg-blue-500 text-white' : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08]'}`}>{state.label}</Button>)}<Button type="button" size="sm" variant="outline" onClick={() => void openPosePicker(version.shotId)} className="h-7 border-white/10 bg-white/[0.04] px-2 text-[11px] text-white/70 hover:bg-white/[0.08]">Change shot pose</Button></div></div></div>; })}{versions.length === 0 ? <EmptyTile title="No generated versions yet" description="Click Launch run when you are ready; generated images will appear here for review." /> : null}</TileGrid>

    <div className={`fixed inset-y-0 right-0 z-50 flex transition-transform duration-300 ease-out ${settingsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full w-[420px] max-w-[92vw] overflow-y-auto border-l border-white/10 bg-[#101014] p-5 shadow-2xl shadow-black/60">
        <div className="mb-5 flex items-start justify-between gap-3"><div><div className="text-lg font-semibold text-white">Run settings</div><div className="mt-1 text-xs text-white/45">Settings affect the next launch. Active jobs are not changed.</div></div><Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(false)} className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]">Close</Button></div>
        <div className="space-y-3"><Info label="Pose set / category" value={poseSetName || 'Not set'} /><Info label="Shot count" value={run ? String(run.count) : 'Not set'} /><Info label="Framing" value={framingPolicyLabel} /><Info label="Model" value={typeof runSettings.modelId === 'string' ? runSettings.modelId : 'z-image'} /><Info label="Resolution" value={typeof resolution.shortSidePx === 'number' && typeof resolution.longSidePx === 'number' ? `${resolution.shortSidePx} × ${resolution.longSidePx}` : 'Default'} />
          <label className="block rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65"><span className="text-xs uppercase tracking-[0.16em] text-white/35">ControlNet strength</span><Input type="number" min={0} max={2} step={0.05} value={controlStrengthDraft} onChange={(event) => setControlStrengthDraft(event.target.value)} className="mt-3 border-white/10 bg-black/30 text-white" /><span className="mt-2 block text-xs text-white/40">Used when a framing/OpenPose control image is attached. Default is 1.</span></label>
          {settingsError ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{settingsError}</div> : null}
          <Button type="button" onClick={() => void saveRunSettings()} disabled={!run || savingSettings} className="w-full bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-50">{savingSettings ? 'Saving…' : 'Save settings'}</Button>
        </div>
      </div>
    </div>

    <Dialog open={Boolean(posePickerShotId)} onOpenChange={(open) => { if (!open) { setPosePickerShotId(null); setPosePickerPoses([]); setPosePickerError(null); } }}><DialogContent className="max-w-5xl border-white/10 bg-[#101014] text-white"><DialogHeader><DialogTitle>{pickerShot ? `Choose pose for ${pickerShot.label}` : 'Choose pose'}</DialogTitle><DialogDescription className="text-white/50">Manual assignment. This updates the shot plan only; it does not launch a generation job.</DialogDescription></DialogHeader>{posePickerError ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{posePickerError}</div> : null}{posePickerLoading ? <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/50">Loading poses…</div> : <div className="grid max-h-[65vh] grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 overflow-y-auto pr-1">{posePickerPoses.map((pose) => { const selected = pickerRevision?.poseId === pose.id; const imageUrl = pose.primaryPreviewUrl || pose.openPose?.imageUrl || null; return <button key={pose.id} type="button" disabled={savingPoseId === pose.id} onClick={() => void choosePose(pose.id)} className={`overflow-hidden rounded-2xl border text-left transition ${selected ? 'border-blue-400/70 bg-blue-500/15' : 'border-white/10 bg-white/[0.035] hover:border-white/25 hover:bg-white/[0.06]'}`}>{imageUrl ? <img src={imageUrl} alt={pose.name} className="aspect-[3/4] w-full object-contain" /> : <div className="flex aspect-[3/4] w-full items-center justify-center bg-black/35 px-3 text-center text-sm text-white/70">{pose.name}</div>}<div className="space-y-1 p-3"><div className="line-clamp-1 text-sm font-medium text-white">{pose.name}</div><div className="text-[11px] text-white/45">{pose.orientation} · {pose.framing}{pose.openPose?.hasOpenPoseImage ? ' · OpenPose' : ''}</div>{selected ? <div className="text-[11px] text-blue-200">Current shot pose</div> : null}{savingPoseId === pose.id ? <div className="text-[11px] text-blue-200">Saving…</div> : null}</div></button>; })}{posePickerPoses.length === 0 ? <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/45">No available poses for this shot category.</div> : null}</div>}</DialogContent></Dialog>
  </div>;
}
function CollectionWorkspace({ detail, portfolioId, onCoverSet }: { detail: CollectionDetail; portfolioId: string | null; onCoverSet: () => void }) {
  const [settingCoverItemId, setSettingCoverItemId] = useState<string | null>(null);
  const setAsCover = async (itemId: string) => {
    if (!portfolioId) return;
    setSettingCoverItemId(itemId);
    try {
      const response = await fetch(`/api/studio/portfolios/${encodeURIComponent(portfolioId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverCollectionItemId: itemId }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to set portfolio cover');
      onCoverSet();
    } finally {
      setSettingCoverItemId(null);
    }
  };
  const items = detail?.items || [];
  return <div className="space-y-5"><div><div className="text-xl font-semibold">{detail?.collection.name || 'Collection'}</div><div className="mt-1 text-sm text-white/45">{items.length} photos</div></div><TileGrid>{items.map((item) => { const url = item.previewUrl || item.thumbnailUrl || item.originalUrl; return <div key={item.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"><div className="aspect-[3/4] bg-black/35">{url ? <img src={url} alt={item.caption || 'Collection item'} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-white/35">No preview</div>}</div><div className="flex items-center justify-between p-4 text-xs text-white/55"><span>#{item.sortOrder + 1}</span><Button size="sm" variant="outline" disabled={settingCoverItemId === item.id} onClick={() => setAsCover(item.id)} className="border-white/10 bg-white/[0.04] text-white/70">{settingCoverItemId === item.id ? 'Setting…' : 'Set as cover'}</Button></div></div>; })}{items.length === 0 ? <EmptyTile title="No photos yet" description="Add reviewed run images into this collection, then choose one as the portfolio cover." /> : null}</TileGrid></div>;
}
