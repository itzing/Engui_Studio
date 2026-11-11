import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { workspaceContext } from "@/lib/workspaces/context";
import { withWorkspaceActivity } from "@/lib/workspaces/activity";
import {
  submitPreparedGeneration,
  type PreparedSubmission,
} from "@/lib/generation/submitFormData";
import { requestJobCancellation } from "@/lib/jobManagement";
import { assertCredential } from "./auth";
import { loadPlan, validatePlan } from "./plans";
import { readMedia } from "./media";
import { preserveVariant } from "./curation";
import { fail, parse } from "./core";

// Only this adapter crosses the paid provider boundary. Tests inject an isolated fake.
export const providerAdapter: {
  submit: (form: FormData, prepared: PreparedSubmission) => Promise<Response>;
  cancel: (job: any) => Promise<void>;
} = {
  submit: submitPreparedGeneration,
  cancel: requestJobCancellation,
};
async function reconcile(workspaceId: string) {
  const rows = await prisma.mcpGenerationVariant.findMany({
    where: {
      workspaceId,
      OR: [
        {
          state: {
            in: [
              "submitting",
              "submission_unknown",
              "running",
              "cancel_requested",
            ],
          },
        },
        { state: "succeeded", assetId: null },
      ],
    },
    include: { batch: true },
  });
  for (const v of rows) {
    const job = await prisma.job.findFirst({ where: { id: v.jobId } });
    const remote = v.providerJobId || job?.runpodJobId;
    if (job?.status === "completed")
      await prisma.mcpGenerationVariant.update({
        where: { id: v.id },
        data: { state: "succeeded", errorCode: null },
      });
    else if (remote) {
      if (job && ["submission_unknown", "queueing_up"].includes(job.status))
        await prisma.job.update({
          where: { id: job.id },
          data: { runpodJobId: remote, status: "queued" },
        });
      if (job?.status === "failed")
        await prisma.mcpGenerationVariant.update({
          where: { id: v.id },
          data: {
            state: job.error === "cancelled" ? "cancelled" : "failed",
            errorCode: job.error === "cancelled" ? null : "PROVIDER_REJECTED",
          },
        });
      else if (job && ["cancelled", "canceled"].includes(job.status))
        await prisma.mcpGenerationVariant.update({
          where: { id: v.id },
          data: { state: "cancelled" },
        });
      else {
        await prisma.mcpGenerationVariant.update({
          where: { id: v.id },
          data: {
            providerJobId: remote,
            state: v.batch.cancelledAt ? "cancel_requested" : "running",
          },
        });
        if (
          v.batch.cancelledAt &&
          job &&
          (!v.cancelSentAt || Date.now() - v.cancelSentAt.getTime() > 60000)
        ) {
          try {
            await providerAdapter.cancel(job);
            await prisma.mcpGenerationVariant.update({
              where: { id: v.id },
              data: { cancelSentAt: new Date() },
            });
          } catch {
            /* Retry cancellation only; never resubmit generation. */
          }
        }
      }
    } else if (
      v.state === "submitting" &&
      (!v.leaseUntil || v.leaseUntil.getTime() < Date.now())
    ) {
      const unknown = !!v.boundaryAt;
      await prisma.mcpGenerationVariant.update({
        where: { id: v.id },
        data: {
          state: unknown ? "submission_unknown" : "failed",
          errorCode: unknown ? "SUBMISSION_UNKNOWN" : "PREPARATION_INTERRUPTED",
        },
      });
      if (job)
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: unknown ? "submission_unknown" : "failed",
            error: unknown
              ? "MCP submission acceptance unknown"
              : "MCP preparation interrupted",
          },
        });
    }
    const current = await prisma.mcpGenerationVariant.findFirst({
      where: { id: v.id },
    });
    if (current?.state === "succeeded" && !current.assetId) {
      try {
        await preserveVariant(current);
      } catch {
        await prisma.mcpGenerationVariant.update({
          where: { id: v.id },
          data: { preservationState: "failed" },
        });
      }
    }
  }
}
async function claim(workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    if (
      await tx.mcpGenerationVariant.count({
        where: { workspaceId, state: "submitting" },
      })
    )
      return null;
    const v = await tx.mcpGenerationVariant.findFirst({
      where: {
        workspaceId,
        state: "queued",
        batch: {
          cancelledAt: null,
          variants: { none: { state: "submission_unknown" } },
        },
      },
      orderBy: [{ createdAt: "asc" }, { index: "asc" }],
      include: { batch: true },
    });
    if (!v) return null;
    const token = randomUUID();
    const changed = await tx.mcpGenerationVariant.updateMany({
      where: { id: v.id, state: "queued" },
      data: {
        state: "submitting",
        dispatchToken: token,
        leaseUntil: new Date(Date.now() + 180000),
      },
    });
    return changed.count ? { ...v, dispatchToken: token } : null;
  });
}
async function dispatch(v: any) {
  const workspaceId = v.workspaceId;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    await assertCredential(v.batch.credentialId, workspaceId);
    const plan = await loadPlan(v.batch.planId);
    await validatePlan(plan, false);
    const d = plan.snapshot.draft,
      p = plan.snapshot.variants[v.index];
    const form = new FormData();
    for (const [key, value] of Object.entries({
      userId: "user-with-settings",
      workspaceId,
      modelId: d.modelId,
      jobId: v.jobId,
      language: "en",
      prompt: p.prompt,
      randomizeSeed: "false",
      ...p.settings,
      ...(d.negativePrompt !== undefined
        ? { negativePrompt: d.negativePrompt }
        : {}),
      ...(d.mode === "image_to_image" ? { task_type: "image_to_image" } : {}),
    }))
      form.set(key, String(value));
    for (let i = 0; i < d.references.length; i++) {
      const image = await readMedia(d.references[i]);
      if (image.hash !== plan.snapshot.references[i].sha256)
        fail("PLAN_STALE", "Reference bytes changed.");
      form.set(
        i ? "image2" : "image",
        new File([new Uint8Array(image.bytes)], `reference-${i + 1}.png`, {
          type: image.mime,
        }),
      );
    }
    for (let i = 0; i < d.loras.length; i++) {
      const l = await prisma.loRA.findFirst({
        where: { id: d.loras[i].id, lifecycle: "active" },
      });
      if (!l?.sourceKey) fail("PLAN_STALE", "LoRA changed.");
      form.set(i ? `lora${i + 1}` : "lora", l.sourceKey);
      form.set(
        i ? `loraWeight${i + 1}` : "loraWeight",
        String(d.loras[i].weight),
      );
    }
    heartbeat = setInterval(() => {
      void prisma.mcpGenerationVariant
        .updateMany({
          where: {
            id: v.id,
            dispatchToken: v.dispatchToken,
            state: "submitting",
          },
          data: { leaseUntil: new Date(Date.now() + 180000) },
        })
        .catch(() => undefined);
    }, 30000);
    heartbeat.unref?.();
    await withWorkspaceActivity(workspaceId, "mcp-dispatch", async () => {
      const response = await providerAdapter.submit(form, {
        prompt: p.prompt,
        metadata: {
          planId: plan.id,
          batchId: v.batchId,
          variantId: v.id,
          variantIndex: v.index,
          snapshot: plan.snapshot,
        },
        beforeProviderSubmit: async (evidence) => {
          await prisma.$transaction(async (tx) => {
            await assertCredential(
              v.batch.credentialId,
              workspaceId,
              "generate",
              tx,
            );
            const b = await tx.mcpGenerationBatch.findFirst({
              where: { id: v.batchId },
            });
            if (!b || b.cancelledAt)
              fail("CANCELLED", "Batch was cancelled before dispatch.");
            const updated = await tx.mcpGenerationVariant.updateMany({
              where: {
                id: v.id,
                dispatchToken: v.dispatchToken,
                state: "submitting",
                boundaryAt: null,
                leaseUntil: { gt: new Date() },
              },
              data: {
                boundaryAt: new Date(),
                leaseUntil: new Date(Date.now() + 180000),
              },
            });
            if (updated.count !== 1)
              fail("SUBMISSION_UNKNOWN", "Dispatch ownership lost.");
            await tx.job.update({
              where: { id: v.jobId },
              data: {
                endpointId: evidence.endpointId,
                secureState: evidence.secureState
                  ? JSON.stringify(evidence.secureState)
                  : null,
              },
            });
          });
        },
        afterProviderAccepted: async (remote) => {
          await prisma.$transaction(async (tx) => {
            const job = await tx.job.findFirst({ where: { id: v.jobId } });
            const secure = parse(job?.secureState);
            await tx.mcpGenerationVariant.update({
              where: { id: v.id },
              data: {
                providerJobId: remote,
                state: "running",
                errorCode: null,
              },
            });
            await tx.job.update({
              where: { id: v.jobId },
              data: {
                runpodJobId: remote,
                status: "queued",
                secureState: JSON.stringify({
                  ...secure,
                  phase: "runpod_queued",
                  activeAttempt: {
                    ...secure.activeAttempt,
                    runpodJobId: remote,
                  },
                }),
              },
            });
          });
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (body.code === "PROVIDER_REJECTED")
          fail("PROVIDER_REJECTED", "Provider rejected the request.");
        throw Error("Submission failed");
      }
    });
  } catch (error: any) {
    const current = await prisma.mcpGenerationVariant.findFirst({
      where: { id: v.id },
    });
    if (!current) return;
    if (current.providerJobId) {
      await prisma.job.updateMany({
        where: { id: v.jobId },
        data: { runpodJobId: current.providerJobId, status: "queued" },
      });
      return;
    }
    const unknown = !!current.boundaryAt && error?.code !== "PROVIDER_REJECTED";
    const cancelled = error?.code === "CANCELLED";
    const code = unknown
      ? "SUBMISSION_UNKNOWN"
      : cancelled
        ? null
        : [
              "PLAN_STALE",
              "MODEL_NOT_CONFIGURED",
              "WORKSPACE_UNAVAILABLE",
              "PROVIDER_REJECTED",
            ].includes(error?.code)
          ? error.code
          : "PREPARATION_FAILED";
    await prisma.mcpGenerationVariant.update({
      where: { id: v.id },
      data: {
        state: unknown
          ? "submission_unknown"
          : cancelled
            ? "cancelled"
            : "failed",
        errorCode: code,
      },
    });
    await prisma.job.updateMany({
      where: { id: v.jobId },
      data: {
        status: unknown ? "submission_unknown" : "failed",
        error: cancelled ? "cancelled" : code,
      },
    });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}
export async function processMcpWorkspace(workspaceId: string) {
  return workspaceContext.run(
    { kind: "workspace", workspaceId, userId: "user-with-settings" },
    async () => {
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (!ws || ws.lifecycle !== "active") return;
      await prisma.mcpRateLimit.deleteMany({
        where: {
          workspaceId,
          window: { lt: Math.floor(Date.now() / 60000) - 3 },
        },
      });
      await reconcile(workspaceId);
      if (process.env.ENGUI_MCP_ENABLED !== "1") return;
      const v = await claim(workspaceId);
      if (v) await dispatch(v);
    },
  );
}
export async function processMcpOnce() {
  // Discovery selects identifiers only; every content operation runs in its own scope.
  const spaces = await prisma.workspace.findMany({
    where: { lifecycle: "active", userId: "user-with-settings" },
    select: { id: true },
  });
  for (const ws of spaces) await processMcpWorkspace(ws.id);
}
const shared = globalThis as typeof globalThis & {
  enguiMcpWorker?: ReturnType<typeof setInterval>;
  enguiMcpWorkerBusy?: boolean;
};
export function startMcpWorker() {
  if (process.env.ENGUI_ISOLATED_VALIDATION === "1" || shared.enguiMcpWorker)
    return;
  const tick = async () => {
    if (shared.enguiMcpWorkerBusy) return;
    shared.enguiMcpWorkerBusy = true;
    try {
      await processMcpOnce();
    } catch {
      console.error("MCP worker cycle failed; no automatic submission retry.");
    } finally {
      shared.enguiMcpWorkerBusy = false;
    }
  };
  shared.enguiMcpWorker = setInterval(() => void tick(), 3000);
  shared.enguiMcpWorker.unref?.();
  void tick();
}
