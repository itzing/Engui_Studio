ALTER TABLE "characters" ADD COLUMN "defaultOutfitId" TEXT REFERENCES "outfits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "studio_photo_sessions" ADD COLUMN "outfitMode" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "studio_photo_sessions" ADD COLUMN "outfitId" TEXT;
ALTER TABLE "studio_pose_library_settings" ADD COLUMN "seededAt" DATETIME;
CREATE TABLE "outfits" (
 "id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL, "ownerCharacterId" TEXT,
 "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "constraints" TEXT NOT NULL DEFAULT '', "coversFace" BOOLEAN NOT NULL DEFAULT false,
 "revision" INTEGER NOT NULL DEFAULT 1, "sourceJson" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL, "deletedAt" DATETIME,
 FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("ownerCharacterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "outfits_workspaceId_deletedAt_idx" ON "outfits"("workspaceId","deletedAt");
CREATE TABLE "character_outfits" (
 "id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL, "characterId" TEXT NOT NULL, "outfitId" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("outfitId") REFERENCES "outfits"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "character_outfits_characterId_outfitId_key" ON "character_outfits"("characterId","outfitId");
CREATE TABLE "character_look_previews" (
 "id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL, "characterId" TEXT NOT NULL, "slot" TEXT NOT NULL,
 "modelId" TEXT NOT NULL, "lookName" TEXT NOT NULL, "snapshotJson" TEXT NOT NULL, "promptSnapshot" TEXT NOT NULL,
 "jobId" TEXT, "status" TEXT NOT NULL DEFAULT 'queued', "imageUrl" TEXT, "thumbnailUrl" TEXT, "error" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" DATETIME NOT NULL,
 FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "character_look_previews_jobId_key" ON "character_look_previews"("jobId");
CREATE INDEX "character_look_previews_workspaceId_characterId_createdAt_idx" ON "character_look_previews"("workspaceId","characterId","createdAt");
