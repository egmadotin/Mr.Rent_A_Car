-- CreateEnum
CREATE TYPE "InspectionKind" AS ENUM ('PICKUP', 'RETURN', 'OTHER');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "inspectionId" TEXT,
ADD COLUMN     "reportedDamageId" TEXT;

-- CreateTable
CREATE TABLE "VehicleInspection" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "InspectionKind" NOT NULL DEFAULT 'OTHER',
    "at" TIMESTAMP(3) NOT NULL,
    "reservationId" TEXT,
    "rentalId" TEXT,
    "odometer" INTEGER,
    "fuel" INTEGER,
    "memo" TEXT,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReportedDamage" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT,
    "reservationId" TEXT,
    "rentalId" TEXT,
    "description" TEXT NOT NULL,
    "conditionId" TEXT,
    "locationId" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReportedDamage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleInspection_vehicleId_at_idx" ON "VehicleInspection"("vehicleId", "at");

-- CreateIndex
CREATE INDEX "CustomerReportedDamage_vehicleId_createdAt_idx" ON "CustomerReportedDamage"("vehicleId", "createdAt");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "VehicleInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_reportedDamageId_fkey" FOREIGN KEY ("reportedDamageId") REFERENCES "CustomerReportedDamage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReportedDamage" ADD CONSTRAINT "CustomerReportedDamage_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReportedDamage" ADD CONSTRAINT "CustomerReportedDamage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReportedDamage" ADD CONSTRAINT "CustomerReportedDamage_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReportedDamage" ADD CONSTRAINT "CustomerReportedDamage_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReportedDamage" ADD CONSTRAINT "CustomerReportedDamage_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReportedDamage" ADD CONSTRAINT "CustomerReportedDamage_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

