export type MobileDetailsListKind = 'jobs' | 'gallery';

export type MobileDetailsSnapshotEntry = {
  id: string;
  absoluteIndex: number;
};

export type MobileDetailsSnapshot = {
  version: 1;
  kind: MobileDetailsListKind;
  workspaceId?: string | null;
  entries: MobileDetailsSnapshotEntry[];
  totalCount: number;
  pageSize: number;
  queryParams?: Record<string, string>;
  updatedAt: number;
};

export type MobileDetailsNavigationState = {
  currentIndex: number | null;
  totalCount: number | null;
  previousId: string | null;
  nextId: string | null;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

export const MOBILE_JOBS_DETAILS_NAVIGATION_KEY = 'engui.mobile.details.jobs.navigation.v1';
export const MOBILE_GALLERY_DETAILS_NAVIGATION_KEY = 'engui.mobile.details.gallery.navigation.v1';

const SNAPSHOT_TTL_MS = 1000 * 60 * 60 * 6;

function getStorageKey(kind: MobileDetailsListKind) {
  return kind === 'jobs' ? MOBILE_JOBS_DETAILS_NAVIGATION_KEY : MOBILE_GALLERY_DETAILS_NAVIGATION_KEY;
}

function normalizeEntries(entries: MobileDetailsSnapshotEntry[]) {
  const seen = new Set<number>();
  return entries
    .filter((entry) => entry.id && Number.isInteger(entry.absoluteIndex) && entry.absoluteIndex >= 0)
    .sort((a, b) => a.absoluteIndex - b.absoluteIndex)
    .filter((entry) => {
      if (seen.has(entry.absoluteIndex)) return false;
      seen.add(entry.absoluteIndex);
      return true;
    });
}

export function writeMobileDetailsSnapshot(kind: MobileDetailsListKind, snapshot: Omit<MobileDetailsSnapshot, 'version' | 'kind' | 'updatedAt'>) {
  if (typeof window === 'undefined') return;

  const normalized: MobileDetailsSnapshot = {
    ...snapshot,
    version: 1,
    kind,
    entries: normalizeEntries(snapshot.entries),
    totalCount: Math.max(0, Math.trunc(snapshot.totalCount)),
    pageSize: Math.max(1, Math.trunc(snapshot.pageSize)),
    updatedAt: Date.now(),
  };

  try {
    window.sessionStorage.setItem(getStorageKey(kind), JSON.stringify(normalized));
  } catch {
    // Ignore storage failures; details can still be used directly without list navigation.
  }
}

export function readMobileDetailsSnapshot(kind: MobileDetailsListKind): MobileDetailsSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MobileDetailsSnapshot>;
    if (parsed.version !== 1 || parsed.kind !== kind || !Array.isArray(parsed.entries)) return null;
    if (typeof parsed.updatedAt !== 'number' || Date.now() - parsed.updatedAt > SNAPSHOT_TTL_MS) return null;
    const pageSize = typeof parsed.pageSize === 'number' && parsed.pageSize > 0 ? Math.trunc(parsed.pageSize) : 24;
    const totalCount = typeof parsed.totalCount === 'number' && parsed.totalCount >= 0 ? Math.trunc(parsed.totalCount) : 0;
    return {
      version: 1,
      kind,
      workspaceId: typeof parsed.workspaceId === 'string' ? parsed.workspaceId : null,
      entries: normalizeEntries(parsed.entries),
      totalCount,
      pageSize,
      queryParams: parsed.queryParams && typeof parsed.queryParams === 'object' ? parsed.queryParams as Record<string, string> : undefined,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function findMobileDetailsEntry(snapshot: MobileDetailsSnapshot | null, id: string): MobileDetailsSnapshotEntry | null {
  if (!snapshot) return null;
  return snapshot.entries.find((entry) => entry.id === id) || null;
}

export function getMobileDetailsEntryIdAtIndex(snapshot: MobileDetailsSnapshot | null, absoluteIndex: number): string | null {
  if (!snapshot) return null;
  return snapshot.entries.find((entry) => entry.absoluteIndex === absoluteIndex)?.id || null;
}

export function buildMobileDetailsNavigationState(
  snapshot: MobileDetailsSnapshot | null,
  currentId: string,
  previousId: string | null = null,
  nextId: string | null = null,
): MobileDetailsNavigationState {
  const entry = findMobileDetailsEntry(snapshot, currentId);
  const currentIndex = entry?.absoluteIndex ?? null;
  const totalCount = snapshot?.totalCount ?? null;
  const canGoPrevious = currentIndex !== null && currentIndex > 0;
  const canGoNext = currentIndex !== null && totalCount !== null && currentIndex < totalCount - 1;

  return {
    currentIndex,
    totalCount,
    previousId: canGoPrevious ? previousId || getMobileDetailsEntryIdAtIndex(snapshot, currentIndex - 1) : null,
    nextId: canGoNext ? nextId || getMobileDetailsEntryIdAtIndex(snapshot, currentIndex + 1) : null,
    canGoPrevious,
    canGoNext,
  };
}
