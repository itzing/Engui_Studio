import { v5 as uuidv5 } from "uuid";
import { assertCredential } from "./auth";
import { type Authority, findReceipt, receipt, McpError } from "./core";
import { deleteJob } from "./jobs";
import { changeGalleryTrash } from "./gallery";

type BatchInput = { requestKey: string };
type ItemError = { code: string; message: string; retryable: boolean };

// Separate namespaces prevent collisions with client keys and with the single-item tools.
function itemKey(operation: string, key: string, index: number) {
  return uuidv5(`${operation}:${key}:${index}`, key);
}

async function deleteBatch<T, R extends object>(
  auth: Authority, operation: string, scope: string, args: BatchInput,
  items: T[], identify: (item: T) => Record<string, string>,
  remove: (item: T, key: string) => Promise<R>,
) {
  await assertCredential(auth.credentialId, auth.workspace.id, scope);
  // Bind the entire ordered payload BEFORE any deletion. This also fences changed
  // payloads when the original request only completed some items before a disconnect.
  await receipt(operation, args.requestKey, args, async () => ({ reserved: true }));
  const results: Array<Record<string, unknown>> = [];
  for (const [index, item] of items.entries()) {
    await assertCredential(auth.credentialId, auth.workspace.id, scope);
    const key = itemKey(operation, args.requestKey, index);
    const checkpointOperation = operation + "_item";
    const previous = await findReceipt(checkpointOperation, key, item);
    if (previous) { results.push(previous); continue; }
    let result: Record<string, unknown>;
    try {
      result = { ...identify(item), ok: true, ...await remove(item, key) };
    } catch (error) {
      // Persist expected item failures too: a retry of this request must not delete
      // a previously busy/changed item after the caller has already seen that failure.
      // Unexpected infrastructure failures abort; same-key retry resumes checkpoints.
      if (!(error instanceof McpError) || error.code === "WORKSPACE_UNAVAILABLE") throw error;
      const safe: ItemError = { code: error.code, message: error.message, retryable: error.retryable };
      result = { ...identify(item), ok: false, error: safe };
    }
    results.push(await receipt(checkpointOperation, key, item, async () => result));
  }
  const succeeded = results.filter(item => item.ok).length;
  return { requestKey: args.requestKey, total: items.length, succeeded, failed: items.length - succeeded, results };
}

export function deleteJobs(auth: Authority, args: { jobIds: string[]; requestKey: string }) {
  return deleteBatch(auth, "delete_jobs_batch", "cancel", args, args.jobIds,
    jobId => ({ jobId }), async (jobId, key) => {
      const result = await deleteJob({ jobId, requestKey: key });
      return { alreadyAbsent: result.alreadyAbsent };
    });
}

export function deleteGalleryAssets(auth: Authority, args: { items: Array<{ assetId: string; expectedRevision: string }>; requestKey: string }) {
  return deleteBatch(auth, "trash_gallery_assets_batch", "curate", args, args.items,
    item => ({ assetId: item.assetId }), async (item, key) => {
      const result = await changeGalleryTrash(auth, { ...item, requestKey: key }, true);
      return { status: result.status, bucket: result.bucket, changed: result.changed, editRevision: result.editRevision };
    });
}
