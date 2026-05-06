import type { StudioSessionShotSummary, StudioSessionShotVersionSummary } from './types';

export function sortStudioSessionVersions<T extends Pick<StudioSessionShotVersionSummary, 'versionNumber' | 'createdAt'>>(versions: T[]): T[] {
  return [...versions].sort((left, right) => right.versionNumber - left.versionNumber || right.createdAt.localeCompare(left.createdAt));
}

export function listPrimaryStudioSessionVersions(versions: StudioSessionShotVersionSummary[]): StudioSessionShotVersionSummary[] {
  return sortStudioSessionVersions(versions.filter((version) => !version.hidden && !version.rejected));
}

export function selectPrimaryStudioSessionVersion(input: {
  shot: Pick<StudioSessionShotSummary, 'selectionVersionId'>;
  versions: StudioSessionShotVersionSummary[];
}): StudioSessionShotVersionSummary | null {
  const primaryVersions = listPrimaryStudioSessionVersions(input.versions);
  return primaryVersions.find((version) => version.id === input.shot.selectionVersionId) ?? primaryVersions[0] ?? null;
}
