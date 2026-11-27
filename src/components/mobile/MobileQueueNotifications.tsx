'use client';

import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, Play, X } from 'lucide-react';
import { useStudio } from '@/lib/context/StudioContext';
import {
  advanceQueueNotifications, emptyQueueNotifications, isActiveQueueStatus, QUEUE_SETTLE_MS,
  readQueueNotifications, writeQueueNotifications, type QueueNotice,
} from '@/lib/mobile/queueNotifications';

const UnreadQueueContext = createContext(false);
export const useUnreadQueueOutcome = () => useContext(UnreadQueueContext);

export default function MobileQueueNotifications({ children }: { children: ReactNode }) {
  const { jobs, jobsLoaded, jobsSyncVersion, activeWorkspaceId } = useStudio();
  const pathname = usePathname();
  const router = useRouter();
  const state = useRef(emptyQueueNotifications());
  const workspace = useRef<string | null>(null);
  const resumeAfterVersion = useRef<number | null>(null);
  const latest = useRef({ jobs, jobsSyncVersion });
  latest.current = { jobs, jobsSyncVersion };
  const [tick, setTick] = useState(0);
  const [banner, setBanner] = useState<QueueNotice | null>(null);
  const [unread, setUnread] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const onJobs = pathname === '/m/jobs' || pathname.startsWith('/m/jobs/');

  useEffect(() => {
    const locateSurface = () => {
      // Modal viewers make body siblings inert. Render within the top dialog so
      // the notification remains both clickable and accessible when it opens.
      const dialogs = document.querySelectorAll<HTMLElement>('.yarl__root, [role="dialog"][data-state="open"]');
      setPortalTarget(dialogs[dialogs.length - 1] || document.body);
    };
    locateSurface();
    const observer = new MutationObserver(locateSurface);
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const resume = () => {
      if (document.visibilityState !== 'hidden' && navigator.onLine !== false) {
        // Wait for the EXISTING poll, not a new request, before replaying an old start.
        resumeAfterVersion.current = latest.current.jobs.some(job => isActiveQueueStatus(job.status))
          ? latest.current.jobsSyncVersion : null;
      } else {
        setBanner(null);
      }
      setTick(value => value + 1);
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', resume);
    };
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    if (workspace.current !== activeWorkspaceId) {
      workspace.current = activeWorkspaceId;
      state.current = readQueueNotifications(activeWorkspaceId);
      resumeAfterVersion.current = null;
      setBanner(null);
      setUnread(state.current.unread && !onJobs);
    }
    if (!jobsLoaded) return;
    const scopedJobs = jobs.filter(job => !job.workspaceId || job.workspaceId === activeWorkspaceId);
    const next = advanceQueueNotifications(state.current, scopedJobs, Date.now());
    if (onJobs) next.unread = false;
    const hasActive = scopedJobs.some(job => isActiveQueueStatus(job.status));
    const resumed = resumeAfterVersion.current === null || jobsSyncVersion > resumeAfterVersion.current || !hasActive;
    if (resumed) resumeAfterVersion.current = null;
    if (next.pending && document.visibilityState !== 'hidden' && navigator.onLine !== false && resumed
      && (next.pending.kind !== 'started' || hasActive)) {
      setBanner(next.pending); // One slot: the final outcome replaces the start.
      next.pending = null; // Persist consumption before another render/remount.
    }
    state.current = next;
    writeQueueNotifications(activeWorkspaceId, next);
    setUnread(next.unread);
    if (next.cycle?.settledAt != null) {
      const timer = window.setTimeout(() => setTick(value => value + 1),
        Math.max(1, QUEUE_SETTLE_MS - (Date.now() - next.cycle!.settledAt!)));
      return () => window.clearTimeout(timer);
    }
  }, [jobs, jobsLoaded, jobsSyncVersion, activeWorkspaceId, onJobs, tick]);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 1000);
    return () => window.clearTimeout(timer);
  }, [banner]);

  const Icon = banner?.kind === 'started' ? Play : banner?.tone === 'success' ? CheckCircle : AlertCircle;
  return (
    <UnreadQueueContext.Provider value={unread}>
      {children}
      {banner && portalTarget && createPortal(
        <div className="pointer-events-none fixed inset-x-0 z-[10050] flex justify-center px-3"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
          <div data-testid="mobile-queue-notification" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-background p-3 text-foreground shadow-xl">
            <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${banner.tone === 'error' ? 'text-red-500' : banner.tone === 'success' ? 'text-green-500' : 'text-blue-500'}`} />
            <div className="min-w-0 flex-1">
              <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-medium">{banner.message}</p>
              <button className="min-h-9 text-sm text-primary underline underline-offset-2" onClick={() => { setBanner(null); router.push('/m/jobs'); }}>View jobs</button>
            </div>
            <button type="button" aria-label="Dismiss queue notification" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
              onClick={() => setBanner(null)}><X aria-hidden="true" className="h-5 w-5" /></button>
          </div>
        </div>, portalTarget)}
    </UnreadQueueContext.Provider>
  );
}
