# Live shared Job navigation

ENGUI-609 fixes externally created Jobs missing from main-screen navigation. The sidebar had its own live list, but StudioContext loaded only the first50records once and then polled only known active IDs. Idle tabs never discovered Jobs created on another device, through MCP or elsewhere.

`useLiveWorkspaceJobs` owns the shared browser Job list. It reads the existing workspace-scoped `/api/jobs?all=true` at initial workspace selection and every5seconds while visible, including when no known Job is active. Focus, online and visibility-return events refresh immediately. This is existing local Job state, not a provider poll or generation request. It discovers arrivals, completions and removals; all Jobs remain available rather than limiting navigation to50.

One request per workspace effect is in flight; fetches time out after20seconds. Cleanup aborts and ignores late responses. Existing workspaceFetch fencing prevents stale-workspace commits; mixed/foreign snapshots are rejected. Failed/malformed reads retain the last good list and do not advance jobsSyncVersion. Local mutation revision plus pending add/status-write guards prevent a snapshot from erasing optimistic updates. jobsLoaded/jobsSyncVersion preserve mobile notification reconciliation.

Preview selection remains ID-based: arrival does not jump away from the current image; arrows see the synchronized list. Desktop/tablet and shared mobile preview benefit. MCP tools, UI layout, stored Jobs, endpoint configuration and provider execution are unchanged. Existing tabs need one reload after deploying the new JavaScript; subsequent external Jobs are discovered automatically.

Validation:13focused hook scenarios,44existing mobile-create/queue-notification tests, production build and actual Chromium/WebKit keyboard navigation on desktop/tablet/phone. Browser fixtures prohibit writes and simulate external arrival/completion/removal, transient read failure and >50records. No paid inference. Keep the previous Next build for rollback; no DB migration.
