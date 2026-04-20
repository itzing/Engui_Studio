'use client';

import { useRouter } from 'next/navigation';
import { Image as ImageIcon, Loader2, RefreshCw, Rows3, Video } from 'lucide-react';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMobilePreviewState } from '@/hooks/mobile/useMobilePreviewState';
import { useMobileJobsScreen } from '@/hooks/jobs/useMobileJobsScreen';

function JobSection({
  title,
  jobs,
  onOpen,
}: {
  title: string;
  jobs: ReturnType<typeof useMobileJobsScreen>['jobs'];
  onOpen: (job: ReturnType<typeof useMobileJobsScreen>['jobs'][number]) => void;
}) {
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="space-y-3">
        {jobs.map((job) => (
          <button key={job.id} type="button" className="block w-full text-left" onClick={() => onOpen(job)}>
            <Card>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/20">
                  {job.thumbnailUrl || job.resultUrl ? (
                    job.type === 'video' ? (
                      <video src={job.resultUrl || undefined} className="h-full w-full object-cover" muted playsInline />
                    ) : job.type === 'image' ? (
                      <img src={job.thumbnailUrl || job.resultUrl || ''} alt={job.prompt || job.modelId} className="h-full w-full object-cover" />
                    ) : (
                      <Rows3 className="h-5 w-5 text-muted-foreground" />
                    )
                  ) : job.type === 'image' ? <ImageIcon className="h-5 w-5 text-muted-foreground" /> : <Video className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-semibold text-foreground">{job.modelId}</div>
                    <div className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300' : job.status === 'failed' ? 'bg-red-500/10 text-red-300' : 'bg-blue-500/10 text-blue-300'}`}>
                      {job.status}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{job.prompt || 'No prompt saved for this job.'}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MobileJobsScreen() {
  const router = useRouter();
  const { setPreview } = useMobilePreviewState();
  const { groupedJobs, isLoading, error, refresh, buildPreview } = useMobileJobsScreen();

  const openJob = (job: ReturnType<typeof useMobileJobsScreen>['jobs'][number]) => {
    setPreview(buildPreview(job));
    router.push('/m/preview');
  };

  return (
    <MobileScreen>
      <MobileHeader
        title="Jobs"
        subtitle="Mobile-first job list with direct route navigation into Preview."
        action={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 custom-scrollbar">
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading jobs...
            </div>
          ) : null}
          {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
          {!isLoading && !error && groupedJobs.active.length === 0 && groupedJobs.recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
              No jobs yet for the current workspace.
            </div>
          ) : null}
          <JobSection title="Active" jobs={groupedJobs.active} onOpen={openJob} />
          <JobSection title="Recent" jobs={groupedJobs.recent} onOpen={openJob} />
        </div>
      </div>
    </MobileScreen>
  );
}
