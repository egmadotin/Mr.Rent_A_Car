-- AlterTable
ALTER TABLE "UserGroup" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "legacyId" INTEGER,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "maxDiscountType" "DiscountType",
ADD COLUMN     "maxDiscountValue" DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "UserGroup_legacyId_key" ON "UserGroup"("legacyId");

