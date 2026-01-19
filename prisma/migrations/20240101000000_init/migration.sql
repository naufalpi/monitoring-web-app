-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'OPERATOR', 'VIEWER');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACK', 'CLOSED');
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "CheckStatus" AS ENUM ('HEALTHY', 'DOWN', 'REDIRECT', 'CHANGED', 'SUSPECTED_DEFACEMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "group" TEXT,
    "intervalSec" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckResult" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "targetId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "status" "CheckStatus" NOT NULL,
    "httpStatus" INTEGER,
    "finalUrl" TEXT,
    "responseTimeMs" INTEGER,
    "htmlHash" TEXT,
    "textHash" TEXT,
    "screenshotPath" TEXT,
    "screenshotPhash" TEXT,
    "title" TEXT,
    "extractedText" TEXT,
    "detectorScore" INTEGER,
    "detectorReasonsJson" JSONB,
    "htmlSnapshotPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "targetId" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "status" "IncidentStatus" NOT NULL,
    "severity" "Severity" NOT NULL,
    "confidence" INTEGER,
    "reasonsJson" JSONB,
    "latestCheckResultId" UUID,
    "acknowledgedById" UUID,
    "acknowledgedAt" TIMESTAMP(3),
    "closedById" UUID,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "cleanStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "targetId" UUID NOT NULL,
    "incidentId" UUID,
    "channel" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadJson" JSONB,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metaJson" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AckToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "incidentId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AckToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Target_isEnabled_idx" ON "Target"("isEnabled");

-- CreateIndex
CREATE INDEX "CheckResult_targetId_startedAt_idx" ON "CheckResult"("targetId", "startedAt");

-- CreateIndex
CREATE INDEX "Incident_targetId_status_idx" ON "Incident"("targetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_latestCheckResultId_key" ON "Incident"("latestCheckResultId");

-- CreateIndex
CREATE INDEX "NotificationLog_targetId_sentAt_idx" ON "NotificationLog"("targetId", "sentAt");

-- CreateIndex
CREATE INDEX "AckToken_tokenHash_idx" ON "AckToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "CheckResult" ADD CONSTRAINT "CheckResult_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_latestCheckResultId_fkey" FOREIGN KEY ("latestCheckResultId") REFERENCES "CheckResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AckToken" ADD CONSTRAINT "AckToken_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

