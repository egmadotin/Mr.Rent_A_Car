-- CreateEnum
CREATE TYPE "ChecklistColor" AS ENUM ('NONE', 'RED', 'GREEN');

-- CreateEnum
CREATE TYPE "DeliveryOrPickup" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateTable
CREATE TABLE "VehicleChecklist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vehicleTypeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "memo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "statusColor" "ChecklistColor" NOT NULL DEFAULT 'NONE',
    "vehicleTypeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "memo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VehicleChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleChecklistRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "reservationId" TEXT,
    "pickupAt" TIMESTAMP(3) NOT NULL,
    "returnAt" TIMESTAMP(3) NOT NULL,
    "mileage" INTEGER,
    "deliveryOrPickup" "DeliveryOrPickup" NOT NULL DEFAULT 'PICKUP',
    "memo" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleChecklistRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleChecklistResult" (
    "recordId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "VehicleChecklistResult_pkey" PRIMARY KEY ("recordId","itemId")
);

-- CreateIndex
CREATE INDEX "VehicleChecklistRecord_vehicleId_pickupAt_idx" ON "VehicleChecklistRecord"("vehicleId", "pickupAt");

-- AddForeignKey
ALTER TABLE "VehicleChecklistItem" ADD CONSTRAINT "VehicleChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "VehicleChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleChecklistRecord" ADD CONSTRAINT "VehicleChecklistRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleChecklistRecord" ADD CONSTRAINT "VehicleChecklistRecord_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleChecklistResult" ADD CONSTRAINT "VehicleChecklistResult_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "VehicleChecklistRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleChecklistResult" ADD CONSTRAINT "VehicleChecklistResult_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "VehicleChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

