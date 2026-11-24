// Shared, client-safe labels. Local stopping does not prove provider cancellation.
export const UNKNOWN_STOP_CODE = "SUBMISSION_UNKNOWN_STOPPED";
export const UNKNOWN_STOP_MESSAGE = "Stopped locally; provider outcome is unknown.";
export const isUncertainJob = (job: {status: string}) => job.status === "submission_unknown";
export const isLocallyStoppedJob = (job: {error?: string | null}) => job.error === UNKNOWN_STOP_MESSAGE;
export const jobStatusLabel = (job: {status: string; error?: string | null}) =>
  isLocallyStoppedJob(job) ? "Stopped locally (provider unknown)" : isUncertainJob(job) ? "Submission uncertain" : job.status;
