// Public execution states are not the worker's durable dispatch lifecycle.
export const variantStates = [
  "queued", "blocked", "submitting", "provider_queued", "running", "finalizing",
  "awaiting_status", "submission_unknown", "cancel_requested", "succeeded", "failed", "cancelled",
] as const;
export type VariantState = (typeof variantStates)[number];
export const terminalVariants = ["succeeded", "failed", "cancelled"];
export const batchStates = [...variantStates, "completed", "partial", "needs_attention"] as const;
const messages: Record<string, string> = {
  queued: "Waiting in Engui's local dispatch queue; not executing at the provider.",
  blocked: "Local dispatch is paused because another variant has unconfirmed submission. Do not resubmit.",
  submitting: "Preparing or sending the provider request; execution is not yet confirmed.",
  provider_queued: "Accepted by the provider and waiting in its queue; inference has not started.",
  running: "The latest stored Job status confirms provider execution.",
  finalizing: "Provider execution has finished; Engui is retrieving and finalizing the output.",
  awaiting_status: "Provider execution cannot be determined from the available Job status. Do not assume it is running or resubmit.",
  submission_unknown: "Provider acceptance is uncertain. Do not resubmit; the remaining batch is paused pending reconciliation.",
  cancel_requested: "Cancellation was requested, but remote completion/cancellation is not yet confirmed. Inspect phase and keep polling.",
  succeeded: "Generation output is complete. Check preservationState for its gallery copy.",
  failed: "Generation failed; inspect each variant's errorCode.",
  cancelled: "Work was cancelled or fenced before dispatch.",
  completed: "All generation variants succeeded. Gallery preservation is reported separately.",
  partial: "All variants are terminal; some succeeded and others failed or were cancelled.",
  needs_attention: "At least one submission is uncertain; do not start a replacement batch or retry generation blindly.",
};
export const statusMessage = (state: string) => messages[state] || messages.awaiting_status;
type Variant = { state: string; providerJobId?: string | null };
type Job = { status: string; runpodJobId?: string | null; error?: string | null };
export function variantStatus(v: Variant, job: Job | null | undefined, cancelled: boolean, blocked: boolean) {
  const jobStatus = job?.status ?? null;
  const normalized = jobStatus?.toLowerCase();
  const providerAccepted = !!(v.providerJobId || job?.runpodJobId);
  let phase: VariantState;
  // Durable terminal results remain valid even if the original Job was deleted.
  if (terminalVariants.includes(v.state)) phase = v.state as VariantState;
  else if (normalized === "completed") phase = "succeeded";
  else if (["cancelled", "canceled"].includes(normalized || "") ||
           (normalized === "failed" && job?.error === "cancelled")) phase = "cancelled";
  else if (normalized === "failed") phase = "failed";
  else if (normalized === "finalizing") phase = "finalizing";
  else if (["processing", "in_progress", "running"].includes(normalized || "")) phase = "running";
  else if (["queued", "in_queue"].includes(normalized || "")) phase = "provider_queued";
  else if (v.state === "submission_unknown" || normalized === "submission_unknown") phase = "submission_unknown";
  else if (providerAccepted) phase = "awaiting_status";
  else if (v.state === "submitting" || normalized === "queueing_up") phase = "submitting";
  else if (v.state === "queued") phase = "queued";
  else phase = "awaiting_status";
  const isTerminal = terminalVariants.includes(phase);
  const cancellationRequested = cancelled || v.state === "cancel_requested";
  const blockedReason = phase === "queued" && blocked && !cancellationRequested ? "SUBMISSION_UNKNOWN" : null;
  const state: VariantState = !isTerminal && phase !== "submission_unknown" && cancellationRequested
    ? "cancel_requested" : blockedReason ? "blocked" : phase;
  return { state, phase, lifecycleState: v.state, jobStatus, providerAccepted,
    cancellationRequested, blockedReason, isTerminal, statusMessage: statusMessage(state) };
}
export function batchState(variants: { state: string }[], cancelled: boolean) {
  const states = variants.map((v) => v.state);
  if (!states.length || states.includes("submission_unknown")) return "needs_attention";
  if (states.every((s) => terminalVariants.includes(s))) {
    if (states.every((s) => s === "succeeded")) return "completed";
    if (states.every((s) => s === "cancelled")) return "cancelled";
    if (states.some((s) => s === "succeeded")) return "partial";
    return "failed";
  }
  if (cancelled || states.includes("cancel_requested")) return "cancel_requested";
  // Ignore terminal variants: a completed sibling must not turn a queued batch into running.
  for (const state of ["running", "finalizing", "submitting", "provider_queued", "awaiting_status", "queued", "blocked"])
    if (states.includes(state)) return state;
  return "awaiting_status";
}
export function batchCounts(variants: { state: string }[]) {
  const count = (state: string) => variants.filter((v) => v.state === state).length;
  return { total: variants.length, queued: count("queued"), blocked: count("blocked"),
    submitting: count("submitting"), providerQueued: count("provider_queued"), running: count("running"),
    finalizing: count("finalizing"), awaitingStatus: count("awaiting_status"),
    submissionUnknown: count("submission_unknown"), cancelRequested: count("cancel_requested"),
    succeeded: count("succeeded"), failed: count("failed"), cancelled: count("cancelled") };
}
