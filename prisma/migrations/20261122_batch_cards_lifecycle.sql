-- Retain submitted jobs and immutable attempt history when deleting a batch.
ALTER TABLE "card_batches" ADD COLUMN "deletedAt" DATETIME;
