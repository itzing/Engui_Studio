"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Job } from "@/lib/context/StudioContext";
import { currentBrowserWorkspaceId, isWorkspaceAbort, workspaceFetchFor } from "@/lib/workspaces/client";

/** The preview/navigation list must discover Jobs created outside this tab too. */
export function useLiveWorkspaceJobs(workspaceId: string | null) {
  const [jobs, setSnapshot] = useState<Job[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [jobsSyncVersion, setJobsSyncVersion] = useState(0);
  const mutationRevision = useRef(0);
  const pendingWrites = useRef(0);
  const setJobs: Dispatch<SetStateAction<Job[]>> = useCallback(update => {
    mutationRevision.current += 1;
    setSnapshot(update);
  }, []);
  const beginJobWrite = useCallback(() => {
    pendingWrites.current += 1;
    mutationRevision.current += 1;
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      pendingWrites.current -= 1;
      mutationRevision.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    const fetch = workspaceFetchFor(workspaceId);
    let disposed = false, inFlight = false;
    let controller: AbortController | null = null;
    const refresh = async (initial = false) => {
      if (disposed || inFlight || (!initial && document.visibilityState === "hidden")) return;
      inFlight = true;
      const revision = mutationRevision.current;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 20000);
      try {
        const params = new URLSearchParams({ userId: "user-with-settings", workspaceId, all: "true" });
        const response = await fetch(`/api/jobs?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (disposed || currentBrowserWorkspaceId() !== workspaceId || pendingWrites.current || revision !== mutationRevision.current) return;
        if (!response.ok || !data.success || !Array.isArray(data.jobs)) return;
        if (data.jobs.some((job: Job) => job.workspaceId !== workspaceId)) return;
        setSnapshot(data.jobs);
        setJobsLoaded(true);
        setJobsSyncVersion(version => version + 1);
      } catch (error) {
        // Keep the last good list on transient failure. Workspace changes abort
        // outstanding requests; neither failures nor aborts clear navigation.
        if (!disposed && !isWorkspaceAbort(error)) console.error("Could not synchronize workspace jobs.");
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
        controller = null;
      }
    };
    const resume = () => { void refresh(); };
    void refresh(true);
    const interval = window.setInterval(resume, 5000);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      controller?.abort();
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [workspaceId]);

  return { jobs, setJobs, jobsLoaded, setJobsLoaded, jobsSyncVersion, beginJobWrite };
}
