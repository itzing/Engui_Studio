-- ENGUI-595 additive migration. Run once after an online SQLite backup.
-- CreateTable
CREATE TABLE "card_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "documentJson" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "card_batches_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "card_batch_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "cardNumber" INTEGER NOT NULL,
    "cardRevision" INTEGER NOT NULL,
    "variantKey" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "dispatchToken" TEXT,
    "leaseUntil" DATETIME,
    "boundaryAt" DATETIME,
    "providerJobId" TEXT,
    "resultUrl" TEXT,
    "thumbnailUrl" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "card_batch_tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "card_batch_tasks_batchId_workspaceId_fkey" FOREIGN KEY ("batchId", "workspaceId") REFERENCES "card_batches" ("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "card_batches_workspaceId_updatedAt_idx" ON "card_batches"("workspaceId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "card_batches_id_workspaceId_key" ON "card_batches"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "card_batch_tasks_jobId_key" ON "card_batch_tasks"("jobId");

-- CreateIndex
CREATE INDEX "card_batch_tasks_workspaceId_state_createdAt_idx" ON "card_batch_tasks"("workspaceId", "state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "card_batch_tasks_batchId_requestKey_variantKey_key" ON "card_batch_tasks"("batchId", "requestKey", "variantKey");

CREATE TRIGGER "card_batches_active_insert" BEFORE INSERT ON "card_batches" WHEN NOT EXISTS (SELECT 1 FROM workspaces WHERE id=NEW.workspaceId AND lifecycle='active') BEGIN SELECT RAISE(ABORT,'Workspace unavailable'); END;

CREATE TRIGGER "card_batches_immutable_workspace" BEFORE UPDATE OF workspaceId ON "card_batches" WHEN OLD.workspaceId<>NEW.workspaceId BEGIN SELECT RAISE(ABORT,'Workspace transfers prohibited'); END;

CREATE TRIGGER "card_batch_tasks_active_insert" BEFORE INSERT ON "card_batch_tasks" WHEN NOT EXISTS (SELECT 1 FROM workspaces WHERE id=NEW.workspaceId AND lifecycle='active') BEGIN SELECT RAISE(ABORT,'Workspace unavailable'); END;

CREATE TRIGGER "card_batch_tasks_immutable_workspace" BEFORE UPDATE OF workspaceId ON "card_batch_tasks" WHEN OLD.workspaceId<>NEW.workspaceId BEGIN SELECT RAISE(ABORT,'Workspace transfers prohibited'); END;
