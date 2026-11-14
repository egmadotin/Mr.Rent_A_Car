-- Rate Blocking / Rate Values Update, Rate Utilization, Overbooking Control, Email Templates
CREATE TYPE "RateRuleKind" AS ENUM ('BLOCK', 'ADJUST');
CREATE TYPE "RateChangeType" AS ENUM ('PERCENT', 'FLAT', 'TOTAL');
CREATE TYPE "OverbookingUnit" AS ENUM ('UNIT', 'PERCENT');

CREATE TABLE "RateRule" (
    "id" TEXT NOT NULL,
    "kind" "RateRuleKind" NOT NULL,
    "locationId" TEXT NOT NULL,
    "rateId" TEXT,
    "vehicleTypeId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "weekdays" BOOLEAN[] DEFAULT ARRAY[true, true, true, true, true, true, true]::BOOLEAN[],
    "changeType" "RateChangeType",
    "value" DECIMAL(10,2),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RateRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RateRule_locationId_kind_idx" ON "RateRule"("locationId", "kind");

CREATE TABLE "RateUtilization" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "rateId" TEXT,
    "vehicleTypeId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "tiers" DECIMAL(6,2)[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RateUtilization_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RateUtilization_locationId_idx" ON "RateUtilization"("locationId");

CREATE TABLE "Overbooking" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "overbookBy" INTEGER NOT NULL,
    "unit" "OverbookingUnit" NOT NULL DEFAULT 'UNIT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Overbooking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Overbooking_locationId_vehicleTypeId_idx" ON "Overbooking"("locationId", "vehicleTypeId");

CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);
