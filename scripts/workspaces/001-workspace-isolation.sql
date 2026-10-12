-- Versioned preservation migration. Run with migrate.py, never directly.
-- CreateTable
CREATE TABLE "workspace_deletions" (
    "workspaceId" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stage" TEXT NOT NULL DEFAULT 'cancel',
    "manifestJson" TEXT NOT NULL DEFAULT '[]',
    "jobsJson" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "workspace_uploads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "storageTarget" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workspace_leases" (
    "workspaceId" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workspace_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "storageTarget" TEXT NOT NULL DEFAULT 'local',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "workspace_migrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checksum" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT,
    "sceneSnapshotJson" TEXT,
    "sourcePromptDocumentId" TEXT,
    "sourcePromptDocumentTitle" TEXT,
    "runpodJobId" TEXT,
    "options" TEXT,
    "secureState" TEXT,
    "resultUrl" TEXT,
    "thumbnailUrl" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelId" TEXT NOT NULL DEFAULT 'unknown',
    "endpointId" TEXT,
    "error" TEXT,
    "cost" REAL,
    "completedAt" DATETIME,
    "executionMs" INTEGER,
    "imageInputPath" TEXT,
    "videoInputPath" TEXT,
    "audioInputPath" TEXT,
    CONSTRAINT "jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_jobs" ("audioInputPath", "completedAt", "cost", "createdAt", "endpointId", "error", "executionMs", "id", "imageInputPath", "isFavorite", "modelId", "options", "prompt", "resultUrl", "runpodJobId", "sceneSnapshotJson", "secureState", "sourcePromptDocumentId", "sourcePromptDocumentTitle", "status", "thumbnailUrl", "type", "userId", "videoInputPath", "workspaceId") SELECT "audioInputPath", "completedAt", "cost", "createdAt", "endpointId", "error", "executionMs", "id", "imageInputPath", "isFavorite", "modelId", "options", "prompt", "resultUrl", "runpodJobId", "sceneSnapshotJson", "secureState", "sourcePromptDocumentId", "sourcePromptDocumentTitle", "status", "thumbnailUrl", "type", "userId", "videoInputPath", COALESCE("workspaceId", '__DEFAULT_WORKSPACE_ID__') FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "new_jobs" RENAME TO "jobs";
CREATE INDEX "jobs_userId_createdAt_idx" ON "jobs"("userId", "createdAt" DESC);
CREATE INDEX "jobs_userId_status_idx" ON "jobs"("userId", "status");
CREATE INDEX "jobs_status_createdAt_idx" ON "jobs"("status", "createdAt" DESC);
CREATE INDEX "jobs_workspaceId_createdAt_idx" ON "jobs"("workspaceId", "createdAt" DESC);
CREATE TABLE "new_presets" (
    "workspaceId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "presets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_presets" ("createdAt", "id", "name", "options", "type", "userId", "workspaceId") SELECT "createdAt", "id", "name", "options", "type", COALESCE((SELECT w."userId" FROM "workspaces" w WHERE w."id" = "presets"."userId"), "userId"), CASE WHEN EXISTS (SELECT 1 FROM "workspaces" w WHERE w."id" = "presets"."userId") THEN "userId" ELSE '__DEFAULT_WORKSPACE_ID__' END FROM "presets";
DROP TABLE "presets";
ALTER TABLE "new_presets" RENAME TO "presets";
CREATE TABLE "new_workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "lifecycle" TEXT NOT NULL DEFAULT 'active',
    "revision" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_workspaces" ("color", "createdAt", "description", "id", "isDefault", "name", "updatedAt", "userId") SELECT "color", "createdAt", "description", "id", "isDefault", "name", "updatedAt", "userId" FROM "workspaces";
DROP TABLE "workspaces";
ALTER TABLE "new_workspaces" RENAME TO "workspaces";
CREATE INDEX "workspaces_userId_idx" ON "workspaces"("userId");
CREATE UNIQUE INDEX "workspaces_userId_name_key" ON "workspaces"("userId", "name");
CREATE TABLE "new_video_projects" (
    "workspaceId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "qualityPreset" TEXT NOT NULL DEFAULT '720p',
    "width" INTEGER NOT NULL DEFAULT 1280,
    "height" INTEGER NOT NULL DEFAULT 720,
    "duration" INTEGER NOT NULL DEFAULT 30000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "video_projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_video_projects" ("aspectRatio", "createdAt", "description", "duration", "height", "id", "qualityPreset", "title", "updatedAt", "width", "workspaceId") SELECT "aspectRatio", "createdAt", "description", "duration", "height", "id", "qualityPreset", "title", "updatedAt", "width", '__DEFAULT_WORKSPACE_ID__' FROM "video_projects";
DROP TABLE "video_projects";
ALTER TABLE "new_video_projects" RENAME TO "video_projects";
CREATE TABLE "new_loras" (
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "storageTarget" TEXT,
    "sourceKey" TEXT,
    "lifecycle" TEXT NOT NULL DEFAULT 'active',
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "s3Path" TEXT NOT NULL,
    "s3Url" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "extension" TEXT NOT NULL,
    "targetOverride" TEXT,
    "baseModel" TEXT NOT NULL DEFAULT 'z-image',
    "workspaceId" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "loras_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_loras" ("baseModel", "extension", "fileName", "fileSize", "id", "name", "s3Path", "s3Url", "targetOverride", "updatedAt", "uploadedAt", "workspaceId") SELECT "baseModel", "extension", "fileName", "fileSize", "id", "name", "s3Path", "s3Url", "targetOverride", "updatedAt", "uploadedAt", COALESCE("workspaceId", '__DEFAULT_WORKSPACE_ID__') FROM "loras";
DROP TABLE "loras";
ALTER TABLE "new_loras" RENAME TO "loras";
CREATE INDEX "loras_workspaceId_idx" ON "loras"("workspaceId");
CREATE INDEX "loras_baseModel_idx" ON "loras"("baseModel");
CREATE INDEX "loras_uploadedAt_idx" ON "loras"("uploadedAt");
CREATE TABLE "new_lora_helper_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "loraId" TEXT,
    "highLoraId" TEXT,
    "lowLoraId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "recommendedHighWeight" REAL,
    "recommendedLowWeight" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_lora_helper_profiles" ("createdAt", "highLoraId", "id", "loraId", "lowLoraId", "notes", "recommendedHighWeight", "recommendedLowWeight", "scope", "updatedAt", "workspaceId") SELECT "createdAt", "highLoraId", "id", "loraId", "lowLoraId", "notes", "recommendedHighWeight", "recommendedLowWeight", "scope", "updatedAt", COALESCE("workspaceId", '__DEFAULT_WORKSPACE_ID__') FROM "lora_helper_profiles";
DROP TABLE "lora_helper_profiles";
ALTER TABLE "new_lora_helper_profiles" RENAME TO "lora_helper_profiles";
CREATE INDEX "lora_helper_profiles_workspaceId_idx" ON "lora_helper_profiles"("workspaceId");
CREATE INDEX "lora_helper_profiles_scope_loraId_idx" ON "lora_helper_profiles"("scope", "loraId");
CREATE INDEX "lora_helper_profiles_scope_highLoraId_lowLoraId_idx" ON "lora_helper_profiles"("scope", "highLoraId", "lowLoraId");
CREATE TABLE "new_characters" (
    "workspaceId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "traits" TEXT NOT NULL DEFAULT '{}',
    "editorState" TEXT NOT NULL DEFAULT '{}',
    "previewStateJson" TEXT NOT NULL DEFAULT '{}',
    "currentVersionId" TEXT,
    "previewStatusSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "characters_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "characters_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "character_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_characters" ("createdAt", "currentVersionId", "deletedAt", "editorState", "gender", "id", "name", "previewStateJson", "previewStatusSummary", "traits", "updatedAt", "workspaceId") SELECT "createdAt", "currentVersionId", "deletedAt", "editorState", "gender", "id", "name", "previewStateJson", "previewStatusSummary", "traits", "updatedAt", '__DEFAULT_WORKSPACE_ID__' FROM "characters";
DROP TABLE "characters";
ALTER TABLE "new_characters" RENAME TO "characters";
CREATE INDEX "characters_updatedAt_idx" ON "characters"("updatedAt" DESC);
CREATE INDEX "characters_deletedAt_updatedAt_idx" ON "characters"("deletedAt", "updatedAt" DESC);
CREATE TABLE "new_vibe_presets" (
    "workspaceId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseDescription" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "compatibleSceneTypes" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vibe_presets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_vibe_presets" ("baseDescription", "compatibleSceneTypes", "createdAt", "id", "name", "status", "tags", "updatedAt", "workspaceId") SELECT "baseDescription", "compatibleSceneTypes", "createdAt", "id", "name", "status", "tags", "updatedAt", '__DEFAULT_WORKSPACE_ID__' FROM "vibe_presets";
DROP TABLE "vibe_presets";
ALTER TABLE "new_vibe_presets" RENAME TO "vibe_presets";
CREATE INDEX "vibe_presets_status_updatedAt_idx" ON "vibe_presets"("status", "updatedAt" DESC);
CREATE INDEX "vibe_presets_updatedAt_idx" ON "vibe_presets"("updatedAt" DESC);
CREATE TABLE "new_job_materialization_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "materializedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_materialization_tasks_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_job_materialization_tasks" ("attemptCount", "createdAt", "id", "jobId", "lastAttemptAt", "lastError", "materializedAt", "payloadJson", "status", "targetId", "targetType", "updatedAt", "workspaceId") SELECT "attemptCount", "createdAt", "id", "jobId", "lastAttemptAt", "lastError", "materializedAt", "payloadJson", "status", "targetId", "targetType", "updatedAt", COALESCE("workspaceId", '__DEFAULT_WORKSPACE_ID__') FROM "job_materialization_tasks";
DROP TABLE "job_materialization_tasks";
ALTER TABLE "new_job_materialization_tasks" RENAME TO "job_materialization_tasks";
CREATE INDEX "job_materialization_tasks_targetType_status_updatedAt_idx" ON "job_materialization_tasks"("targetType", "status", "updatedAt" DESC);
CREATE INDEX "job_materialization_tasks_targetId_status_updatedAt_idx" ON "job_materialization_tasks"("targetId", "status", "updatedAt" DESC);
CREATE INDEX "job_materialization_tasks_workspaceId_status_updatedAt_idx" ON "job_materialization_tasks"("workspaceId", "status", "updatedAt" DESC);
CREATE INDEX "job_materialization_tasks_status_updatedAt_idx" ON "job_materialization_tasks"("status", "updatedAt" DESC);
CREATE UNIQUE INDEX "job_materialization_tasks_jobId_targetType_targetId_key" ON "job_materialization_tasks"("jobId", "targetType", "targetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "workspace_uploads_uploadId_key" ON "workspace_uploads"("uploadId");

-- CreateIndex
CREATE INDEX "workspace_uploads_workspaceId_status_idx" ON "workspace_uploads"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_files_workspaceId_storageTarget_location_key" ON "workspace_files"("workspaceId", "storageTarget", "location");


CREATE TABLE "workspace_activities" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "workspace_activities_workspaceId_expiresAt_idx" ON "workspace_activities"("workspaceId", "expiresAt");
