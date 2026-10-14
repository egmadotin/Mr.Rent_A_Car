-- DropIndex
DROP INDEX "RateValue_rateId_vehicleTypeId_key";

-- AlterTable
ALTER TABLE "Rate" ADD COLUMN     "availableDays" BOOLEAN[] DEFAULT ARRAY[true, true, true, true, true, true, true]::BOOLEAN[],
ADD COLUMN     "maxDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RateValue" ADD COLUMN     "extraDaily" DECIMAL(10,2),
ADD COLUMN     "extraKmCharge" DECIMAL(10,2),
ADD COLUMN     "kmHourly" INTEGER,
ADD COLUMN     "kmMonthly" INTEGER,
ADD COLUMN     "kmWeekly" INTEGER,
ADD COLUMN     "seasonId" TEXT;

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "locationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RateValue_rateId_vehicleTypeId_seasonId_key" ON "RateValue"("rateId", "vehicleTypeId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_name_key" ON "Season"("name");

-- AddForeignKey
ALTER TABLE "RateValue" ADD CONSTRAINT "RateValue_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

