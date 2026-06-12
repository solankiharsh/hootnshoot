-- Post now: publish as soon as Content Cop approves (see Prisma ComplianceJob.publishWhenApproved).
ALTER TABLE "ComplianceJob"
  ADD COLUMN IF NOT EXISTS "publishWhenApproved" BOOLEAN NOT NULL DEFAULT false;
