-- CreateEnum
CREATE TYPE "VehicleInsuranceAction" AS ENUM ('NO_INSURANCE', 'FULL_COVERAGE', 'LIABILITY_ONLY', 'COMPREHENSIVE_ONLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LookupKind" ADD VALUE 'DAMAGE_LOCATION';
ALTER TYPE "LookupKind" ADD VALUE 'DAMAGE_CONDITION';

-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT,
    "odometer" INTEGER,
    "nextDateRequired" BOOLEAN NOT NULL DEFAULT false,
    "nextDate" TIMESTAMP(3),
    "nextType" TEXT,
    "nextOdometer" INTEGER,
    "shop" TEXT,
    "shopContactName" TEXT,
    "shopPhone" TEXT,
    "labourCost" DECIMAL(10,2),
    "partsCost" DECIMAL(10,2),
    "paymentMethod" "PaymentMethod",
    "paymentAmount" DECIMAL(10,2),
    "poNumber" TEXT,
    "memo" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleRepair" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dateDue" TIMESTAMP(3),
    "pickupDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "pickupLocationId" TEXT,
    "returnLocationId" TEXT,
    "odometerOut" INTEGER,
    "odometerIn" INTEGER,
    "shopName" TEXT,
    "totalParts" DECIMAL(10,2),
    "totalLabour" DECIMAL(10,2),
    "repairOrderNumber" TEXT,
    "purchaseOrderNumber" TEXT,
    "description" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleRepair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleProblem" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "odometer" INTEGER,
    "status" "VehicleStatus",
    "description" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCarwash" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "odometer" INTEGER,
    "updateOdometer" BOOLEAN NOT NULL DEFAULT false,
    "washedBy" TEXT,
    "spotNumber" TEXT,
    "memo" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleCarwash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDamage" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "rentalId" TEXT,
    "locationId" TEXT,
    "conditionId" TEXT,
    "total" DECIMAL(10,2) NOT NULL,
    "imageKey" TEXT,
    "memo" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDamage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAccident" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "rentalId" TEXT,
    "fullName" TEXT,
    "location" TEXT,
    "description" TEXT,
    "memo" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleAccident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleServiceVoucher" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "voucherNumber" TEXT,
    "expirationDate" DATE,
    "memo" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleServiceVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleInsuranceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "expiryDate" DATE,
    "actionType" "VehicleInsuranceAction" NOT NULL,
    "insuranceAmount" DECIMAL(10,2),
    "deductibleAmount" DECIMAL(10,2),
    "policyNumber" TEXT,
    "reason" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleInsuranceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleStatusChange" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "VehicleStatus" NOT NULL,
    "fromStatus" "VehicleStatus",
    "changedAt" TIMESTAMP(3) NOT NULL,
    "dueBackAt" TIMESTAMP(3),
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleMaintenance_vehicleId_date_idx" ON "VehicleMaintenance"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleRepair_vehicleId_date_idx" ON "VehicleRepair"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleProblem_vehicleId_date_idx" ON "VehicleProblem"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleCarwash_vehicleId_date_idx" ON "VehicleCarwash"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleDamage_vehicleId_date_idx" ON "VehicleDamage"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleAccident_vehicleId_date_idx" ON "VehicleAccident"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "VehicleStatusChange_vehicleId_changedAt_idx" ON "VehicleStatusChange"("vehicleId", "changedAt");

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleRepair" ADD CONSTRAINT "VehicleRepair_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProblem" ADD CONSTRAINT "VehicleProblem_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCarwash" ADD CONSTRAINT "VehicleCarwash_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDamage" ADD CONSTRAINT "VehicleDamage_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDamage" ADD CONSTRAINT "VehicleDamage_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDamage" ADD CONSTRAINT "VehicleDamage_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAccident" ADD CONSTRAINT "VehicleAccident_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleServiceVoucher" ADD CONSTRAINT "VehicleServiceVoucher_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInsuranceRecord" ADD CONSTRAINT "VehicleInsuranceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleStatusChange" ADD CONSTRAINT "VehicleStatusChange_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

