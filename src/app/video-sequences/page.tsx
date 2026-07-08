import Link from 'next/link';
import { ArrowLeft, Clapperboard, Film, Images, Layers3, Play, Plus, Save, Scissors, Sparkles, Waypoints } from 'lucide-react';

import { Button } from '@/components/ui/button';

const templateCards = [
  { name: 'Slow push-in', category: 'Camera', accent: 'border-cyan-500/40 text-cyan-300' },
  { name: 'Turn head', category: 'Pose', accent: 'border-violet-500/40 text-violet-300' },
  { name: 'Expression shift', category: 'Performance', accent: 'border-rose-500/40 text-rose-300' },
  { name: 'Camera orbit', category: 'Camera', accent: 'border-amber-500/40 text-amber-300' },
];

const segments = [
  { index: 1, title: 'Opening frame', status: 'Completed', source: 'Initial image', tone: 'border-emerald-500/40 text-emerald-300' },
  { index: 2, title: 'Follow motion', status: 'Draft', source: 'Previous last frame', tone: 'border-white/15 text-white/70' },
  { index: 3, title: 'Reaction beat', status: 'Template', source: 'Previous last frame', tone: 'border-violet-500/40 text-violet-300' },
];

export default function VideoSequencesPage() {
  return (
    <main className="flex h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100">
      <aside className="flex w-[292px] shrink-0 flex-col border-r border-white/10 bg-zinc-950">
        <div className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-zinc-300 hover:bg-white/10 hover:text-white">
            <Link href="/" aria-label="Back to workspace">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Video Sequences</div>
            <div className="truncate text-xs text-zinc-500">Desktop sequence builder</div>
          </div>
        </div>

        <div className="border-b border-white/10 p-4">
          <Button className="h-9 w-full justify-start gap-2" disabled>
            <Plus className="h-4 w-4" />
            New sequence
          </Button>
        </div>

        <section className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Segment templates</h2>
            <Sparkles className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="space-y-2">
            {templateCards.map((template) => (
              <button
                key={template.name}
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{template.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{template.category}</span>
                </span>
                <span className={`rounded border px-2 py-0.5 text-[10px] ${template.accent}`}>Ready</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-zinc-950 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <Waypoints className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">Untitled sequence</h1>
              <div className="truncate text-xs text-zinc-500">3 segments - WAN22 image-to-video chain</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 gap-2 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10" disabled>
              <Play className="h-4 w-4" />
              Generate from here
            </Button>
            <Button variant="outline" className="h-9 gap-2 border-white/10 bg-transparent text-zinc-200 hover:bg-white/10" disabled>
              <Scissors className="h-4 w-4" />
              Render final
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden p-5">
            <div className="flex min-w-max items-center gap-3">
              {segments.map((segment, segmentIndex) => (
                <div key={segment.index} className="flex items-center gap-3">
                  <article className="w-[280px] overflow-hidden rounded-md border border-white/10 bg-zinc-900">
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/10 bg-black/30 text-xs text-zinc-300">
                          {segment.index}
                        </span>
                        <span className="truncate text-sm font-medium">{segment.title}</span>
                      </div>
                      <span className={`rounded border px-2 py-0.5 text-[10px] ${segment.tone}`}>{segment.status}</span>
                    </div>
                    <div className="grid grid-cols-[72px_1fr_72px] gap-px bg-white/10">
                      <div className="aspect-[3/4] bg-zinc-950 p-2">
                        <div className="flex h-full items-center justify-center rounded border border-white/10 bg-zinc-900 text-zinc-500">
                          <Images className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="aspect-video bg-zinc-950 p-2">
                        <div className="flex h-full items-center justify-center rounded border border-white/10 bg-zinc-900 text-zinc-400">
                          <Film className="h-6 w-6" />
                        </div>
                      </div>
                      <div className="aspect-[3/4] bg-zinc-950 p-2">
                        <div className="flex h-full items-center justify-center rounded border border-white/10 bg-zinc-900 text-zinc-500">
                          <Images className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-500">
                      <span className="truncate">{segment.source}</span>
                      <span>6s</span>
                    </div>
                  </article>
                  {segmentIndex < segments.length - 1 ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-500">
                      <Waypoints className="h-4 w-4" />
                    </div>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                className="flex h-[184px] w-[180px] shrink-0 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/15 bg-white/[0.02] text-zinc-500 transition-colors hover:border-white/25 hover:text-zinc-300"
              >
                <Plus className="h-5 w-5" />
                <span className="text-sm">Add segment</span>
              </button>
            </div>
          </div>

          <div className="h-28 shrink-0 border-t border-white/10 bg-zinc-950 px-5 py-3">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
              <span>Sequence timeline</span>
              <span>00:00 - 00:18</span>
            </div>
            <div className="flex h-12 overflow-hidden rounded-md border border-white/10 bg-zinc-900">
              {segments.map((segment) => (
                <div key={segment.index} className="flex flex-1 items-center border-r border-white/10 px-3 last:border-r-0">
                  <div className="h-2 w-full rounded-full bg-zinc-700">
                    <div className="h-2 rounded-full bg-cyan-400/70" style={{ width: segment.status === 'Completed' ? '100%' : '38%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="flex w-[360px] shrink-0 flex-col border-l border-white/10 bg-zinc-950">
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <div>
            <h2 className="text-sm font-semibold">Segment inspector</h2>
            <div className="text-xs text-zinc-500">Opening frame</div>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent text-zinc-300 hover:bg-white/10" disabled>
            <Save className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <section className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <Images className="h-4 w-4" />
                Source
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-3">
                <div className="aspect-[3/4] rounded border border-white/10 bg-zinc-900" />
                <div className="min-w-0 text-sm">
                  <div className="truncate font-medium">Initial image</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">Gallery asset - frozen source - 832 x 1216</div>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <Clapperboard className="h-4 w-4" />
                Prompt
              </div>
              <div className="rounded border border-white/10 bg-zinc-950 p-3 text-sm leading-6 text-zinc-300">
                The subject continues the previous pose with a slow camera push-in, subtle facial motion, and stable clothing details.
              </div>
            </section>

            <section className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <Layers3 className="h-4 w-4" />
                LoRA set
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded border border-white/10 bg-zinc-950 px-3 py-2">
                  <span>High noise</span>
                  <span className="text-zinc-500">0.80</span>
                </div>
                <div className="flex items-center justify-between rounded border border-white/10 bg-zinc-950 px-3 py-2">
                  <span>Low noise</span>
                  <span className="text-zinc-500">0.80</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </aside>
    </main>
  );
}
