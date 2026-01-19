-- AlterTable
ALTER TABLE "AckToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CheckResult" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Incident" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NotificationLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Target" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Incident_status_severity_openedAt_idx" ON "Incident"("status", "severity", "openedAt");

-- CreateIndex
CREATE INDEX "Target_group_idx" ON "Target"("group");

-- CreateIndex
CREATE INDEX "Target_createdAt_idx" ON "Target"("createdAt");
