'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Camera, FolderPlus, Image, Play, Plus, RefreshCw, Settings, SlidersHorizontal, UserRound } from 'lucide-react';
import CharacterSelectModal from '@/components/characters/CharacterSelectModal';
import StudioSessionsPageClient from '@/components/studio-sessions/StudioSessionsPageClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudio } from '@/lib/context/StudioContext';
import type { CharacterSummary } from '@/lib/characters/types';
import type { StudioCollectionSummary, StudioPhotoSessionSummary, StudioPortfolioSummary, StudioPoseSetSummary, StudioSessionRunSummary } from '@/lib/studio-sessions/types';

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function EmptyWorkspaceState() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      Select or create a workspace before using Studio.
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
      <span className="text-white/90">{value}</span> {label}
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">{children}</div>;
}

function PortfolioCard({ portfolio, selected, onClick }: { portfolio: StudioPortfolioSummary; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[220px] flex-col overflow-hidden rounded-2xl border text-left transition-colors ${selected ? 'border-blue-400/60 bg-blue-500/10' : 'border-white/10 bg-white/[0.035] hover:border-white/25 hover:bg-white/[0.06]'}`}
    >
      <div className="relative h-36 bg-black/30">
        {portfolio.characterPreviewUrl ? (
          <img src={portfolio.characterPreviewUrl} alt={`${portfolio.characterName} preview`} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/30"><UserRound className="h-10 w-10" /></div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
          <div className="truncate text-sm font-semibold text-white">{portfolio.name}</div>
          <div className="truncate text-xs text-white/55">{portfolio.characterName}</div>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <p className="line-clamp-2 text-xs text-white/50">{portfolio.description || 'Character portfolio for coherent photo sessions and final sets.'}</p>
        <div className="flex flex-wrap gap-2">
          <StatPill label="sessions" value={portfolio.sessionCount} />
          <StatPill label="collections" value={portfolio.collectionCount} />
          <StatPill label="selected" value={portfolio.selectedImageCount} />
        </div>
      </div>
    </button>
  );
}

function SessionCard({ session, selected, onClick }: { session: StudioPhotoSessionSummary; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-colors ${selected ? 'border-blue-400/60 bg-blue-500/10' : 'border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/[0.05]'}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{session.name}</div>
          <div className="mt-0.5 text-xs capitalize text-white/45">{session.status}</div>
        </div>
        <div className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/50">{session.runCount} runs</div>
      </div>
      <div className="space-y-1 text-xs text-white/55">
        <div className="line-clamp-1">Setting: {session.settingText || 'Not set'}</div>
        <div className="line-clamp-1">Light/Vibe: {[session.lightingText, session.vibeText].filter(Boolean).join(' · ') || 'Not set'}</div>
        <div className="line-clamp-1">Outfit: {session.outfitText || 'Not set'}</div>
      </div>
    </button>
  );
}

function CreatePortfolioDialog({
  open,
  characters,
  loadingCharacters,
  creating,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  characters: CharacterSummary[];
  loadingCharacters: boolean;
  creating: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (character: CharacterSummary) => void;
}) {
  return (
    <CharacterSelectModal
      open={open}
      characters={characters}
      loading={loadingCharacters || creating}
      selectedCharacterId={null}
      onOpenChange={onOpenChange}
      onSelect={onCreate}
    />
  );
}

function SessionBriefEditor({
  session,
  saving,
  onSave,
}: {
  session: StudioPhotoSessionSummary | null;
  saving: boolean;
  onSave: (next: Partial<StudioPhotoSessionSummary>) => void;
}) {
  const [draft, setDraft] = useState<Partial<StudioPhotoSessionSummary>>({});

  useEffect(() => {
    setDraft(session ? { ...session } : {});
  }, [session]);

  if (!session) {
    return (
      <Card className="border-white/10 bg-white/[0.035] text-white">
        <CardHeader>
          <CardTitle className="text-base">Session Brief</CardTitle>
          <CardDescription className="text-white/45">Select or create a session to edit the shoot setting.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const setField = (field: keyof StudioPhotoSessionSummary) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
  };

  return (
    <Card className="border-white/10 bg-white/[0.035] text-white">
      <CardHeader>
        <CardTitle className="text-base">Session Brief</CardTitle>
        <CardDescription className="text-white/45">A session is one coherent shoot: setting, light, vibe, outfit, and hair.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <FieldLabel>Name</FieldLabel>
          <Input value={draft.name ?? ''} onChange={setField('name')} className="border-white/10 bg-black/30 text-white" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>Setting</FieldLabel>
            <Input value={draft.settingText ?? ''} onChange={setField('settingText')} className="border-white/10 bg-black/30 text-white" placeholder="Loft bedroom, white cyclorama…" />
          </div>
          <div>
            <FieldLabel>Lighting</FieldLabel>
            <Input value={draft.lightingText ?? ''} onChange={setField('lightingText')} className="border-white/10 bg-black/30 text-white" placeholder="Soft window light…" />
          </div>
          <div>
            <FieldLabel>Vibe</FieldLabel>
            <Input value={draft.vibeText ?? ''} onChange={setField('vibeText')} className="border-white/10 bg-black/30 text-white" placeholder="Quiet editorial, playful…" />
          </div>
          <div>
            <FieldLabel>Outfit</FieldLabel>
            <Input value={draft.outfitText ?? ''} onChange={setField('outfitText')} className="border-white/10 bg-black/30 text-white" placeholder="Black bodysuit…" />
          </div>
          <div>
            <FieldLabel>Hairstyle</FieldLabel>
            <Input value={draft.hairstyleText ?? ''} onChange={setField('hairstyleText')} className="border-white/10 bg-black/30 text-white" placeholder="Loose waves…" />
          </div>
          <div>
            <FieldLabel>Negative prompt</FieldLabel>
            <Input value={draft.negativePrompt ?? ''} onChange={setField('negativePrompt')} className="border-white/10 bg-black/30 text-white" />
          </div>
        </div>
        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea
            value={draft.notes ?? ''}
            onChange={setField('notes')}
            rows={3}
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
          />
        </div>
        <Button disabled={saving} onClick={() => onSave(draft)} className="bg-blue-500 text-white hover:bg-blue-400">
          {saving ? 'Saving…' : 'Save brief'}
        </Button>
      </CardContent>
    </Card>
  );
}


type RunSettingsDraft = {
  name: string;
  poseSetId: string;
  count: number;
  positivePromptOverride: string;
  negativePromptOverride: string;
  generationSettings: {
    modelId: string;
    steps: number;
    cfg: number;
    seed: number;
  };
  resolutionPolicy: {
    shortSidePx: number;
    longSidePx: number;
    squareSideSource: 'short' | 'long';
  };
};

const defaultRunDraft: RunSettingsDraft = {
  name: '',
  poseSetId: '',
  count: 5,
  positivePromptOverride: '',
  negativePromptOverride: '',
  generationSettings: { modelId: 'z-image', steps: 9, cfg: 1, seed: -1 },
  resolutionPolicy: { shortSidePx: 1024, longSidePx: 1536, squareSideSource: 'short' },
};

function RunSettingsPanel({
  poseSets,
  creating,
  onCreate,
}: {
  poseSets: StudioPoseSetSummary[];
  creating: boolean;
  onCreate: (draft: RunSettingsDraft) => void;
}) {
  const [draft, setDraft] = useState<RunSettingsDraft>(defaultRunDraft);

  useEffect(() => {
    if (!draft.poseSetId && poseSets[0]) {
      setDraft((current) => ({ ...current, poseSetId: poseSets[0].id }));
    }
  }, [draft.poseSetId, poseSets]);

  const selectedPoseSet = poseSets.find((poseSet) => poseSet.id === draft.poseSetId) ?? null;
  const canCreate = Boolean(draft.poseSetId) && draft.count > 0;

  return (
    <Card className="border-white/10 bg-white/[0.035] text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="h-4 w-4 text-white/50" /> Create Run</CardTitle>
        <CardDescription className="text-white/45">One run uses exactly one pose set. Session brief fields are inherited from the selected photo session.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <FieldLabel>Run name</FieldLabel>
          <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="border-white/10 bg-black/30 text-white" placeholder={selectedPoseSet?.name ?? 'Run name'} />
        </div>
        <div>
          <FieldLabel>Pose set</FieldLabel>
          <select
            value={draft.poseSetId}
            onChange={(event) => setDraft((current) => ({ ...current, poseSetId: event.target.value }))}
            className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/25"
          >
            {poseSets.map((poseSet) => (
              <option key={poseSet.id} value={poseSet.id} className="bg-[#101014] text-white">{poseSet.name} ({poseSet.poseIds.length})</option>
            ))}
          </select>
          {selectedPoseSet ? <div className="mt-2 text-xs text-white/45">{selectedPoseSet.description}</div> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <FieldLabel>Count</FieldLabel>
            <Input type="number" min={1} max={50} value={draft.count} onChange={(event) => setDraft((current) => ({ ...current, count: Math.max(1, Math.min(50, Number(event.target.value) || 1)) }))} className="border-white/10 bg-black/30 text-white" />
          </div>
          <div>
            <FieldLabel>Short side</FieldLabel>
            <Input type="number" min={64} value={draft.resolutionPolicy.shortSidePx} onChange={(event) => setDraft((current) => ({ ...current, resolutionPolicy: { ...current.resolutionPolicy, shortSidePx: Math.max(64, Number(event.target.value) || 1024) } }))} className="border-white/10 bg-black/30 text-white" />
          </div>
          <div>
            <FieldLabel>Long side</FieldLabel>
            <Input type="number" min={64} value={draft.resolutionPolicy.longSidePx} onChange={(event) => setDraft((current) => ({ ...current, resolutionPolicy: { ...current.resolutionPolicy, longSidePx: Math.max(64, Number(event.target.value) || 1536) } }))} className="border-white/10 bg-black/30 text-white" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>Positive override</FieldLabel>
            <textarea value={draft.positivePromptOverride} onChange={(event) => setDraft((current) => ({ ...current, positivePromptOverride: event.target.value }))} rows={3} className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
          </div>
          <div>
            <FieldLabel>Negative override</FieldLabel>
            <textarea value={draft.negativePromptOverride} onChange={(event) => setDraft((current) => ({ ...current, negativePromptOverride: event.target.value }))} rows={3} className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
          </div>
        </div>
        <Button disabled={!canCreate || creating} onClick={() => onCreate({ ...draft, name: draft.name || selectedPoseSet?.name || 'Studio run' })} className="bg-blue-500 text-white hover:bg-blue-400">
          {creating ? 'Creating…' : 'Create run'}
        </Button>
      </CardContent>
    </Card>
  );
}

function RunCard({ run, launching, onLaunch }: { run: StudioSessionRunSummary; launching: boolean; onLaunch: () => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{run.name || run.templateNameSnapshot || 'Untitled run'}</div>
          <div className="mt-1 text-xs text-white/45">{run.poseSetId || 'No pose set'} · {run.count} shots · <span className="capitalize">{run.status.replace(/_/g, ' ')}</span></div>
        </div>
        <Button size="sm" disabled={launching} onClick={onLaunch} className="bg-emerald-500 text-white hover:bg-emerald-400">
          <Play className="mr-2 h-3.5 w-3.5" /> {launching ? 'Launching…' : 'Launch'}
        </Button>
      </div>
    </div>
  );
}

export default function StudioPortfolioPageClient() {
  const { activeWorkspaceId } = useStudio();
  const [legacyMode, setLegacyMode] = useState(false);
  const [portfolios, setPortfolios] = useState<StudioPortfolioSummary[]>([]);
  const [sessions, setSessions] = useState<StudioPhotoSessionSummary[]>([]);
  const [collections, setCollections] = useState<StudioCollectionSummary[]>([]);
  const [runs, setRuns] = useState<StudioSessionRunSummary[]>([]);
  const [poseSets, setPoseSets] = useState<StudioPoseSetSummary[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);
  const [launchingRunId, setLaunchingRunId] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [showCreatePortfolio, setShowCreatePortfolio] = useState(false);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLegacyMode(new URLSearchParams(window.location.search).get('legacy') === '1');
    }
  }, []);

  const selectedPortfolio = useMemo(() => portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null, [portfolios, selectedPortfolioId]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedSessionId) ?? null, [sessions, selectedSessionId]);

  const fetchCharacters = useCallback(async () => {
    setLoadingCharacters(true);
    try {
      const response = await fetch('/api/characters', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch characters');
      setCharacters(Array.isArray(data.characters) ? data.characters : []);
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, 'Failed to fetch characters'));
    } finally {
      setLoadingCharacters(false);
    }
  }, []);

  const fetchPoseSets = useCallback(async () => {
    try {
      const response = await fetch('/api/studio/pose-sets', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch pose sets');
      setPoseSets(Array.isArray(data.poseSets) ? data.poseSets : []);
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, 'Failed to fetch pose sets'));
    }
  }, []);

  const fetchPortfolios = useCallback(async (workspaceId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/studio/portfolios?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch portfolios');
      const nextPortfolios = Array.isArray(data.portfolios) ? data.portfolios as StudioPortfolioSummary[] : [];
      setPortfolios(nextPortfolios);
      setSelectedPortfolioId((current) => current && nextPortfolios.some((portfolio) => portfolio.id === current) ? current : nextPortfolios[0]?.id ?? null);
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, 'Failed to fetch portfolios'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPortfolioDetail = useCallback(async (portfolioId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/studio/portfolios/${encodeURIComponent(portfolioId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch portfolio detail');
      const nextSessions = Array.isArray(data.sessions) ? data.sessions as StudioPhotoSessionSummary[] : [];
      const nextCollections = Array.isArray(data.collections) ? data.collections as StudioCollectionSummary[] : [];
      setSessions(nextSessions);
      setCollections(nextCollections);
      setSelectedSessionId((current) => current && nextSessions.some((session) => session.id === current) ? current : nextSessions[0]?.id ?? null);
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, 'Failed to fetch portfolio detail'));
    }
  }, []);

  const fetchSessionDetail = useCallback(async (sessionId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/studio/sessions/${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to fetch session detail');
      setRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch (fetchError) {
      setError(toErrorMessage(fetchError, 'Failed to fetch session detail'));
    }
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId || legacyMode) return;
    fetchPortfolios(activeWorkspaceId);
    fetchCharacters();
    fetchPoseSets();
  }, [activeWorkspaceId, fetchCharacters, fetchPortfolios, fetchPoseSets, legacyMode]);

  useEffect(() => {
    if (!selectedPortfolioId || legacyMode) {
      setSessions([]);
      setCollections([]);
      setRuns([]);
      return;
    }
    fetchPortfolioDetail(selectedPortfolioId);
  }, [fetchPortfolioDetail, legacyMode, selectedPortfolioId]);

  useEffect(() => {
    if (!selectedSessionId || legacyMode) {
      setRuns([]);
      return;
    }
    fetchSessionDetail(selectedSessionId);
  }, [fetchSessionDetail, legacyMode, selectedSessionId]);

  const createPortfolio = async (character: CharacterSummary) => {
    if (!activeWorkspaceId) return;
    setCreatingPortfolio(true);
    setError(null);
    try {
      const response = await fetch('/api/studio/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: activeWorkspaceId, characterId: character.id }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create portfolio');
      setShowCreatePortfolio(false);
      setMessage('Portfolio created.');
      await fetchPortfolios(activeWorkspaceId);
      setSelectedPortfolioId(data.portfolio.id);
    } catch (createError) {
      setError(toErrorMessage(createError, 'Failed to create portfolio'));
    } finally {
      setCreatingPortfolio(false);
    }
  };

  const createSession = async () => {
    if (!selectedPortfolioId) return;
    setCreatingSession(true);
    setError(null);
    try {
      const response = await fetch(`/api/studio/portfolios/${encodeURIComponent(selectedPortfolioId)}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New photo session' }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create session');
      setShowCreateSession(false);
      setMessage('Session created.');
      await fetchPortfolioDetail(selectedPortfolioId);
      setSelectedSessionId(data.session.id);
    } catch (createError) {
      setError(toErrorMessage(createError, 'Failed to create session'));
    } finally {
      setCreatingSession(false);
    }
  };

  const saveSession = async (next: Partial<StudioPhotoSessionSummary>) => {
    if (!selectedSession) return;
    setSavingSession(true);
    setError(null);
    try {
      const response = await fetch(`/api/studio/sessions/${encodeURIComponent(selectedSession.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save session');
      setMessage('Session brief saved.');
      if (selectedPortfolioId) await fetchPortfolioDetail(selectedPortfolioId);
    } catch (saveError) {
      setError(toErrorMessage(saveError, 'Failed to save session'));
    } finally {
      setSavingSession(false);
    }
  };

  const createRun = async (draft: RunSettingsDraft) => {
    if (!selectedSessionId) return;
    setCreatingRun(true);
    setError(null);
    try {
      const response = await fetch(`/api/studio/sessions/${encodeURIComponent(selectedSessionId)}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create run');
      setMessage('Run created.');
      await fetchSessionDetail(selectedSessionId);
      if (selectedPortfolioId) await fetchPortfolioDetail(selectedPortfolioId);
    } catch (createError) {
      setError(toErrorMessage(createError, 'Failed to create run'));
    } finally {
      setCreatingRun(false);
    }
  };

  const launchRun = async (runId: string) => {
    setLaunchingRunId(runId);
    setError(null);
    try {
      const response = await fetch(`/api/studio/runs/${encodeURIComponent(runId)}/launch`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to launch run');
      setMessage(`Launch requested: ${Array.isArray(data.launched) ? data.launched.length : 0} jobs started.`);
      if (selectedSessionId) await fetchSessionDetail(selectedSessionId);
    } catch (launchError) {
      setError(toErrorMessage(launchError, 'Failed to launch run'));
    } finally {
      setLaunchingRunId(null);
    }
  };

  if (legacyMode) {
    return (
      <div className="space-y-4">
        <Button variant="outline" className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => setLegacyMode(false)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to portfolio Studio
        </Button>
        <StudioSessionsPageClient />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f11] p-6 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/35">Studio</div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Character Portfolios</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/50">Portfolio → Photo Sessions → Runs → Results → Collections. Templates are now a legacy/preset concept, not the primary flow.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => activeWorkspaceId && fetchPortfolios(activeWorkspaceId)} disabled={!activeWorkspaceId || loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" className="border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => setLegacyMode(true)}>
              <Settings className="mr-2 h-4 w-4" /> Legacy templates
            </Button>
            <Button className="bg-blue-500 text-white hover:bg-blue-400" onClick={() => setShowCreatePortfolio(true)} disabled={!activeWorkspaceId}>
              <Plus className="mr-2 h-4 w-4" /> New portfolio
            </Button>
          </div>
        </div>

        {!activeWorkspaceId ? <EmptyWorkspaceState /> : null}
        {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {message ? <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="grid gap-3">
              {loading ? <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-8 text-center text-sm text-white/45">Loading portfolios…</div> : null}
              {!loading && portfolios.length === 0 ? (
                <Card className="border-white/10 bg-white/[0.035] text-white">
                  <CardHeader>
                    <CardTitle className="text-base">No portfolios yet</CardTitle>
                    <CardDescription className="text-white/45">Create a portfolio from a Character Manager character to start a coherent set of shoots.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="bg-blue-500 text-white hover:bg-blue-400" onClick={() => setShowCreatePortfolio(true)} disabled={!activeWorkspaceId}>Create portfolio</Button>
                  </CardContent>
                </Card>
              ) : null}
              {portfolios.map((portfolio) => (
                <PortfolioCard key={portfolio.id} portfolio={portfolio} selected={portfolio.id === selectedPortfolioId} onClick={() => setSelectedPortfolioId(portfolio.id)} />
              ))}
            </div>
          </div>

          <Card className="min-h-[560px] border-white/10 bg-white/[0.035] text-white">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{selectedPortfolio?.name ?? 'Select a portfolio'}</CardTitle>
                  <CardDescription className="text-white/45">{selectedPortfolio ? `${selectedPortfolio.characterName} · ${selectedPortfolio.description || 'Portfolio detail'}` : 'Portfolio details will appear here.'}</CardDescription>
                </div>
                {selectedPortfolio ? (
                  <div className="flex flex-wrap gap-2">
                    <StatPill label="sessions" value={sessions.length} />
                    <StatPill label="collections" value={collections.length} />
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedPortfolio ? (
                <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-white/40">Choose or create a portfolio.</div>
              ) : (
                <Tabs defaultValue="sessions" className="space-y-5">
                  <TabsList className="bg-black/30">
                    <TabsTrigger value="sessions"><Camera className="mr-2 h-4 w-4" /> Sessions</TabsTrigger>
                    <TabsTrigger value="collections"><Image className="mr-2 h-4 w-4" /> Collections</TabsTrigger>
                    <TabsTrigger value="character"><UserRound className="mr-2 h-4 w-4" /> Character</TabsTrigger>
                  </TabsList>

                  <TabsContent value="sessions" className="mt-0 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <Button className="w-full bg-blue-500 text-white hover:bg-blue-400" onClick={() => setShowCreateSession(true)}>
                        <Plus className="mr-2 h-4 w-4" /> New photo session
                      </Button>
                      {sessions.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">No sessions yet.</div> : null}
                      {sessions.map((session) => <SessionCard key={session.id} session={session} selected={session.id === selectedSessionId} onClick={() => setSelectedSessionId(session.id)} />)}
                    </div>
                    <div className="space-y-5">
                      <SessionBriefEditor session={selectedSession} saving={savingSession} onSave={saveSession} />
                      {selectedSession ? (
                        <>
                          <RunSettingsPanel poseSets={poseSets} creating={creatingRun} onCreate={createRun} />
                          <Card className="border-white/10 bg-white/[0.035] text-white">
                            <CardHeader>
                              <CardTitle className="text-base">Runs</CardTitle>
                              <CardDescription className="text-white/45">Each run is scoped to one pose set and creates a shot slot list for review.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {runs.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">No runs yet. Create one from the settings panel above.</div> : null}
                              {runs.map((run) => <RunCard key={run.id} run={run} launching={launchingRunId === run.id} onLaunch={() => launchRun(run.id)} />)}
                            </CardContent>
                          </Card>
                        </>
                      ) : null}
                    </div>
                  </TabsContent>

                  <TabsContent value="collections" className="mt-0">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {collections.length === 0 ? <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">Collections will collect final picks across sessions.</div> : null}
                      {collections.map((collection) => (
                        <div key={collection.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FolderPlus className="h-4 w-4 text-white/50" /> {collection.name}</div>
                          <p className="line-clamp-2 text-xs text-white/50">{collection.description || 'Final set collection.'}</p>
                          <div className="mt-3"><StatPill label="items" value={collection.itemCount} /></div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="character" className="mt-0">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                      <div className="mb-1 text-white">{selectedPortfolio.characterName}</div>
                      <div>Character canon is owned by Character Manager. This tab will surface identity/preview context in the next UI slice.</div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreatePortfolioDialog
        open={showCreatePortfolio}
        characters={characters}
        loadingCharacters={loadingCharacters}
        creating={creatingPortfolio}
        onOpenChange={setShowCreatePortfolio}
        onCreate={createPortfolio}
      />

      <Dialog open={showCreateSession} onOpenChange={setShowCreateSession}>
        <DialogContent className="border-white/10 bg-[#101014] text-white">
          <DialogHeader>
            <DialogTitle>Create photo session</DialogTitle>
            <DialogDescription className="text-white/50">Create a blank session, then fill the brief on the Sessions tab.</DialogDescription>
          </DialogHeader>
          <Button disabled={creatingSession} onClick={createSession} className="bg-blue-500 text-white hover:bg-blue-400">
            {creatingSession ? 'Creating…' : 'Create blank session'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
