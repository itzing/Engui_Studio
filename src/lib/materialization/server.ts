import { prisma } from '@/lib/prisma';
import {
  normalizeJobMaterializationPayload,
  type JobMaterializationPayload,
  type MaterializationTargetType,
} from '@/lib/materialization/types';
import { characterPreviewMaterializationHandler } from '@/lib/characters/server';
import { studioPoseOpenPoseMaterializationHandler, studioPosePreviewMaterializationHandler } from '@/lib/studio-sessions/poseLibraryServer';

type PersistedJobRecord = {
  id: string;
  status: string;
  type: string | null;
  prompt: string | null;
  options: string | null;
  resultUrl: string | null;
  thumbnailUrl: string | null;
  modelId: string | null;
  endpointId: string | null;
  error: string | null;
  completedAt: Date | null;
  executionMs: number | null;
};

type PersistedTaskRecord = {
  id: string;
  jobId: string;
  workspaceId: string | null;
  targetType: string;
  targetId: string;
  payloadJson: string | null;
  status: string;
  attemptCount: number;
  lastAttemptAt: Date | null;
  materializedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MaterializationDbLike = {
  jobMaterializationTask: {
    findFirst: (args: Record<string, unknown>) => Promise<PersistedTaskRecord | null>;
    findMany: (args: Record<string, unknown>) => Promise<PersistedTaskRecord[]>;
    create: (args: Record<string, unknown>) => Promise<PersistedTaskRecord>;
    update: (args: Record<string, unknown>) => Promise<PersistedTaskRecord>;
  };
};

type MaterializationContext<TPayload extends JobMaterializationPayload = JobMaterializationPayload> = {
  job: PersistedJobRecord;
  task: PersistedTaskRecord;
  payload: TPayload;
};

type MaterializationHandler<TPayload extends JobMaterializationPayload = JobMaterializationPayload> = {
  materialize: (context: MaterializationContext<TPayload>) => Promise<void>;
  onSourceJobFailed?: (context: MaterializationContext<TPayload> & { sourceError: string }) => Promise<void>;
};

const handlers: Partial<Record<MaterializationTargetType, MaterializationHandler>> = {
  character_preview: characterPreviewMaterializationHandler,
  studio_pose_preview: studioPosePreviewMaterializationHandler,
  studio_pose_openpose: studioPoseOpenPoseMaterializationHandler,
};

function parseTaskPayload(payloadJson: string | null | undefined): JobMaterializationPayload {
  if (!payloadJson) return {};

  try {
    const parsed = JSON.parse(payloadJson);
    return normalizeJobMaterializationPayload(parsed);
  } catch (error) {
    console.warn('Failed to parse job materialization payload:', error);
    return {};
  }
}

function getJobMaterializationTable(db: MaterializationDbLike = prisma as unknown as MaterializationDbLike) {
  return db.jobMaterializationTask;
}

async function markTaskProcessing(taskId: string) {
  await (prisma as any).jobMaterializationTask.update({
    where: { id: taskId },
    data: {
      status: 'processing',
      lastAttemptAt: new Date(),
      lastError: null,
      attemptCount: {
        increment: 1,
      },
    },
  });
}

async function markTaskMaterialized(taskId: string) {
  await (prisma as any).jobMaterializationTask.update({
    where: { id: taskId },
    data: {
      status: 'materialized',
      materializedAt: new Date(),
      lastError: null,
    },
  });
}

async function markTaskFailed(taskId: string, errorMessage: string) {
  await (prisma as any).jobMaterializationTask.update({
    where: { id: taskId },
    data: {
      status: 'failed',
      lastError: errorMessage,
    },
  });
}

function getSourceFailureMessage(job: PersistedJobRecord) {
  return job.error || 'Source job failed before materialization';
}

export async function createJobMaterializationTask(
  input: {
    jobId: string;
    workspaceId?: string | null;
    targetType: MaterializationTargetType;
    targetId: string;
    payload?: JobMaterializationPayload;
  },
  db: MaterializationDbLike = prisma as unknown as MaterializationDbLike,
) {
  const table = getJobMaterializationTable(db);
  const payloadJson = JSON.stringify(normalizeJobMaterializationPayload(input.payload));
  const existing = await table.findFirst({
    where: {
      jobId: input.jobId,
      targetType: input.targetType,
      targetId: input.targetId,
    },
  });

  if (existing) {
    return table.update({
      where: { id: existing.id },
      data: {
        workspaceId: input.workspaceId ?? null,
        payloadJson,
        status: 'pending',
        materializedAt: null,
        lastError: null,
      },
    });
  }

  return table.create({
    data: {
      jobId: input.jobId,
      workspaceId: input.workspaceId ?? null,
      targetType: input.targetType,
      targetId: input.targetId,
      payloadJson,
      status: 'pending',
    },
  });
}

async function processTask(task: PersistedTaskRecord, job: PersistedJobRecord) {
  const handler = handlers[task.targetType as MaterializationTargetType];
  if (!handler) {
    await markTaskFailed(task.id, `No materialization handler registered for target type \"${task.targetType}\"`);
    return;
  }

  const payload = parseTaskPayload(task.payloadJson);

  if (job.status === 'completed') {
    await markTaskProcessing(task.id);
    try {
      await handler.materialize({ job, task, payload });
      await markTaskMaterialized(task.id);
    } catch (error: any) {
      await markTaskFailed(task.id, error?.message || 'Unknown materialization error');
    }
    return;
  }

  if (job.status === 'failed') {
    const sourceError = getSourceFailureMessage(job);
    await markTaskProcessing(task.id);
    try {
      if (handler.onSourceJobFailed) {
        await handler.onSourceJobFailed({ job, task, payload, sourceError });
      }
      await markTaskFailed(task.id, sourceError);
    } catch (error: any) {
      await markTaskFailed(task.id, error?.message || sourceError);
    }
  }
}

export async function settleJobMaterializationTasks(jobId: string) {
  const job = await (prisma as any).job.findUnique({
    where: { id: jobId },
  }) as PersistedJobRecord | null;

  if (!job || (job.status !== 'completed' && job.status !== 'failed')) {
    return;
  }

  const tasks = await (prisma as any).jobMaterializationTask.findMany({
    where: {
      jobId,
      status: { in: ['pending', 'processing', 'failed'] },
    },
    orderBy: { createdAt: 'asc' },
  }) as PersistedTaskRecord[];

  for (const task of tasks) {
    await processTask(task, job);
  }
}

export async function recoverJobMaterializationTasks(input: { limit?: number; targetTypes?: MaterializationTargetType[] } = {}) {
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.floor(input.limit as number)) : 200;
  const where: Record<string, unknown> = {
    status: { in: ['pending', 'processing', 'failed'] },
  };

  if (input.targetTypes?.length) {
    where.targetType = { in: input.targetTypes };
  }

  const tasks = await (prisma as any).jobMaterializationTask.findMany({
    where,
    orderBy: { updatedAt: 'asc' },
    take: limit,
  }) as PersistedTaskRecord[];

  const jobIds = Array.from(new Set(tasks.map((task) => task.jobId)));
  for (const jobId of jobIds) {
    await settleJobMaterializationTasks(jobId);
  }
}
