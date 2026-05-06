'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStudio } from '@/lib/context/StudioContext';

function EmptyWorkspaceState() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      Select or create a workspace before using Studio Sessions.
    </div>
  );
}

function TemplatesTab({ workspaceId }: { workspaceId: string | null }) {
  return (
    <div className="space-y-4">
      {!workspaceId ? (
        <EmptyWorkspaceState />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
          <Card className="border-white/10 bg-white/5">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardDescription>Templates</CardDescription>
              <CardTitle className="text-lg">Studio Session templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-sm text-white/70">
              <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">
                Template list lands in ENGUI-227.3.
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardDescription>Editor</CardDescription>
              <CardTitle className="text-lg">Template editor shell</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 text-sm text-white/70">
              <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                This route shell is ready for the upcoming template list and editor implementation.
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/45">Workspace</div>
                  <div className="mt-2 font-medium text-white">{workspaceId}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/45">Current scope</div>
                  <div className="mt-2 text-white/75">Desktop-only Studio Sessions module</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function RunsTab({ workspaceId }: { workspaceId: string | null }) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="border-b border-white/10 pb-4">
        <CardDescription>Runs</CardDescription>
        <CardTitle className="text-lg">Run workspace shell</CardTitle>
      </CardHeader>
      <CardContent className="p-4 text-sm text-white/70">
        {!workspaceId ? (
          <EmptyWorkspaceState />
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-white/50">
            Runs surface is reserved for ENGUI-228.* after template persistence is in place.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StudioSessionsPageClient() {
  const { activeWorkspaceId, workspaces } = useStudio();
  const [tab, setTab] = useState<'templates' | 'runs'>('templates');

  const effectiveWorkspaceId = useMemo(() => activeWorkspaceId || workspaces[0]?.id || null, [activeWorkspaceId, workspaces]);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-white">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">Studio Sessions</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Studio Photo Session</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              Separate desktop workspace for reusable session templates and immutable run-based review flows.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
            Active workspace: <span className="font-medium text-white">{effectiveWorkspaceId ?? 'none selected'}</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'templates' | 'runs')} className="flex min-h-0 flex-col gap-4">
          <TabsList className="w-fit bg-white/[0.05]">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="runs">Runs</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-0">
            <TemplatesTab workspaceId={effectiveWorkspaceId} />
          </TabsContent>

          <TabsContent value="runs" className="mt-0">
            <RunsTab workspaceId={effectiveWorkspaceId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
