-- CreateEnum
CREATE TYPE "SignatureCondition" AS ENUM ('ADDED', 'NOT_ADDED', 'ALWAYS');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('SIGNATURE', 'INITIALS');

-- CreateTable
CREATE TABLE "SignatureSetup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "condition" "SignatureCondition" NOT NULL DEFAULT 'ADDED',
    "type" "SignatureType" NOT NULL DEFAULT 'SIGNATURE',
    "effectiveDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "miscChargeId" TEXT,
    "insuranceId" TEXT,
    "disclaimer" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureSetup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureSetup_code_key" ON "SignatureSetup"("code");

-- AddForeignKey
ALTER TABLE "SignatureSetup" ADD CONSTRAINT "SignatureSetup_miscChargeId_fkey" FOREIGN KEY ("miscChargeId") REFERENCES "MiscCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureSetup" ADD CONSTRAINT "SignatureSetup_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "Insurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

