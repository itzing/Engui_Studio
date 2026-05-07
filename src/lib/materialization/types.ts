export const MATERIALIZATION_TARGET_TYPES = [
  'character_preview',
  'scene_preview',
  'studio_session_version',
] as const;

export const JOB_MATERIALIZATION_STATUSES = [
  'pending',
  'processing',
  'materialized',
  'failed',
] as const;

export type MaterializationTargetType = (typeof MATERIALIZATION_TARGET_TYPES)[number];
export type JobMaterializationStatus = (typeof JOB_MATERIALIZATION_STATUSES)[number];
export type JobMaterializationPayload = Record<string, unknown>;

export function normalizeJobMaterializationPayload(input: unknown): JobMaterializationPayload {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  return input as JobMaterializationPayload;
}
