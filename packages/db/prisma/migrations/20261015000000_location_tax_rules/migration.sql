-- AlterTable
ALTER TABLE "LocationTax" ADD COLUMN     "appliesTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hasRules" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insuranceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "legacyId" INTEGER,
ADD COLUMN     "miscChargeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "taxIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "LocationTax_legacyId_key" ON "LocationTax"("legacyId");

