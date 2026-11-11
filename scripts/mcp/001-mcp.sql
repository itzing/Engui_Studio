-- AlterTable
ALTER TABLE "gallery_assets" ADD COLUMN "membershipKey" TEXT;

-- CreateTable
CREATE TABLE "mcp_credentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "scopesJson" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_credentials_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mcp_generation_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "inputDigest" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_generation_plans_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mcp_generation_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_generation_batches_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mcp_generation_batches_planId_workspaceId_fkey" FOREIGN KEY ("planId", "workspaceId") REFERENCES "mcp_generation_plans" ("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mcp_generation_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "dispatchToken" TEXT,
    "leaseUntil" DATETIME,
    "boundaryAt" DATETIME,
    "providerJobId" TEXT,
    "errorCode" TEXT,
    "assetId" TEXT,
    "preservationState" TEXT NOT NULL DEFAULT 'pending',
    "cancelSentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mcp_generation_variants_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mcp_generation_variants_batchId_workspaceId_fkey" FOREIGN KEY ("batchId", "workspaceId") REFERENCES "mcp_generation_batches" ("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mcp_operation_receipts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "inputDigest" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "retiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_operation_receipts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "character_concept_references" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "assetId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "snapshotJson" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "character_concept_references_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "character_concept_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "character_concept_reviews_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mcp_rate_limits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "window" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "mcp_rate_limits_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "mcp_credentials_workspaceId_idx" ON "mcp_credentials"("workspaceId");

-- CreateIndex
CREATE INDEX "mcp_generation_plans_workspaceId_createdAt_idx" ON "mcp_generation_plans"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_generation_plans_id_workspaceId_key" ON "mcp_generation_plans"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_generation_batches_planId_key" ON "mcp_generation_batches"("planId");

-- CreateIndex
CREATE INDEX "mcp_generation_batches_workspaceId_createdAt_idx" ON "mcp_generation_batches"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_generation_batches_planId_workspaceId_key" ON "mcp_generation_batches"("planId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_generation_batches_id_workspaceId_key" ON "mcp_generation_batches"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_generation_variants_jobId_key" ON "mcp_generation_variants"("jobId");

-- CreateIndex
CREATE INDEX "mcp_generation_variants_workspaceId_state_idx" ON "mcp_generation_variants"("workspaceId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_generation_variants_batchId_index_key" ON "mcp_generation_variants"("batchId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_operation_receipts_workspaceId_operation_requestKey_key" ON "mcp_operation_receipts"("workspaceId", "operation", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "character_concept_references_workspaceId_characterId_key" ON "character_concept_references"("workspaceId", "characterId");

-- CreateIndex
CREATE INDEX "character_concept_reviews_workspaceId_characterId_createdAt_idx" ON "character_concept_reviews"("workspaceId", "characterId", "createdAt");

-- CreateIndex
CREATE INDEX "mcp_rate_limits_workspaceId_window_idx" ON "mcp_rate_limits"("workspaceId", "window");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_assets_workspaceId_bucket_membershipKey_key" ON "gallery_assets"("workspaceId", "bucket", "membershipKey");

