-- AlterEnum
ALTER TYPE "ChargeKind" ADD VALUE 'PROTECTION';

-- AlterEnum
ALTER TYPE "RateCalculation" ADD VALUE 'PERCENT';

-- AlterTable
ALTER TABLE "ChargeLine" ADD COLUMN     "insuranceId" TEXT;

-- AlterTable
ALTER TABLE "MiscCharge" ADD COLUMN     "allVehicleTypes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoWhenAdditionalDriver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoWhenUnderAge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultRentcarsCom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "displayAtEndRental" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "displayAtStartRental" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "displayOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "effectiveDate" DATE,
ADD COLUMN     "endDate" DATE,
ADD COLUMN     "extraDailyRate" DECIMAL(10,2),
ADD COLUMN     "graceMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "group" TEXT,
ADD COLUMN     "hourlyRate" DECIMAL(10,2),
ADD COLUMN     "imageKey" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMandatory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isNoShowCharge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPrepaidFuel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "maxDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "milesIncluded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyRate" DECIMAL(10,2),
ADD COLUMN     "multiSelectOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rentcarsCom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tollAdminFeeWaiver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valuePricing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyRate" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "MiscChargeVehicleType" (
    "miscChargeId" TEXT NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,

    CONSTRAINT "MiscChargeVehicleType_pkey" PRIMARY KEY ("miscChargeId","vehicleTypeId")
);

-- CreateTable
CREATE TABLE "Insurance" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "calculationBy" "RateCalculation" NOT NULL,
    "hourlyRate" DECIMAL(10,2),
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "weeklyRate" DECIMAL(10,2),
    "monthlyRate" DECIMAL(10,2),
    "extraDailyRate" DECIMAL(10,2),
    "deductible" DECIMAL(10,2),
    "graceMinutes" INTEGER NOT NULL DEFAULT 0,
    "effectiveDate" DATE,
    "endDate" DATE,
    "minDays" INTEGER NOT NULL DEFAULT 0,
    "maxDays" INTEGER NOT NULL DEFAULT 0,
    "group" TEXT,
    "description" TEXT,
    "imageKey" TEXT,
    "allVehicleTypes" BOOLEAN NOT NULL DEFAULT true,
    "displayOnline" BOOLEAN NOT NULL DEFAULT false,
    "rentcarsCom" BOOLEAN NOT NULL DEFAULT false,
    "defaultRentcarsCom" BOOLEAN NOT NULL DEFAULT false,
    "valuePricing" BOOLEAN NOT NULL DEFAULT false,
    "isDeposit" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Insurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceVehicleType" (
    "insuranceId" TEXT NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,

    CONSTRAINT "InsuranceVehicleType_pkey" PRIMARY KEY ("insuranceId","vehicleTypeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Insurance_legacyId_key" ON "Insurance"("legacyId");

-- AddForeignKey
ALTER TABLE "MiscCharge" ADD CONSTRAINT "MiscCharge_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiscChargeVehicleType" ADD CONSTRAINT "MiscChargeVehicleType_miscChargeId_fkey" FOREIGN KEY ("miscChargeId") REFERENCES "MiscCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiscChargeVehicleType" ADD CONSTRAINT "MiscChargeVehicleType_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insurance" ADD CONSTRAINT "Insurance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceVehicleType" ADD CONSTRAINT "InsuranceVehicleType_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "Insurance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceVehicleType" ADD CONSTRAINT "InsuranceVehicleType_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeLine" ADD CONSTRAINT "ChargeLine_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "Insurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
