import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { fail, id, modelId } from "./core";

// Operator-owned, never writable through MCP. Read afresh so approval changes also fence queued work.
const policySchema = z.object({
  enabledModels: z.array(modelId).max(4),
  workspacePreferences: z.record(id, z.object({ preferredVibeId: id }).strict()).default({}),
}).strict();
export type OperatorPolicy = z.infer<typeof policySchema>;
const initialPolicy: OperatorPolicy = { enabledModels: ["z-image", "krea2-turbo"], workspacePreferences: {} };
export async function readOperatorPolicy(): Promise<OperatorPolicy> {
  const override = process.env.ENGUI_MCP_POLICY_PATH;
  const filename = override || path.join(os.homedir(), ".config", "engui-mcp", "operator-policy.json");
  try {
    const raw = await fs.readFile(filename, "utf8");
    return policySchema.parse(JSON.parse(raw));
  } catch (error) {
    if (!override && (error as NodeJS.ErrnoException).code === "ENOENT") return initialPolicy;
    fail("MODEL_POLICY_UNAVAILABLE", "The operator model policy is unavailable or invalid. Ask the owner to check it; do not start a generation.");
  }
}
export function modelAvailability(model: string, configured: boolean, policy: OperatorPolicy) {
  const enabledByOwner = policy.enabledModels.some(id => id === model);
  return {
    enabledByOwner,
    available: enabledByOwner && configured,
    availabilityReason: !enabledByOwner ? "Disabled by the owner. Only the owner can enable this model."
      : !configured ? "Approved by the owner, but the endpoint or required transport settings are not configured." : null,
  };
}
export async function assertModelAllowed(model: string) {
  if (!(await readOperatorPolicy()).enabledModels.some(id => id === model))
    fail("MODEL_UNAVAILABLE", "The selected model is disabled by the owner. Use an available model from engui_list_models; only the owner can enable another model.");
}
export async function preferredVibeId() {
  return (await readOperatorPolicy()).workspacePreferences[requireWorkspaceId()]?.preferredVibeId;
}
export function preferredVibeMarker(id: string, status: string, preferredId: string | undefined) {
  return status === "active" && id === preferredId ? { preferred: true as const } : {};
}
