'use client';
import { useRef } from 'react';
import { currentBrowserWorkspaceId, workspaceFetchFor } from './client';
export function useWorkspaceFetch() {
  const owner = useRef(currentBrowserWorkspaceId());
  const scopedFetch = useRef(workspaceFetchFor(owner.current));
  return scopedFetch.current;
}
