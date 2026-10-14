-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "closestAirport" TEXT,
ADD COLUMN     "closestIntersection" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "displayOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DECIMAL(9,6),
ADD COLUMN     "longitude" DECIMAL(9,6),
ADD COLUMN     "memo" TEXT,
ADD COLUMN     "minimumAge" INTEGER,
ADD COLUMN     "tollFree" TEXT,
ADD COLUMN     "underAge" INTEGER;

-- CreateTable
CREATE TABLE "VehicleTypeLocation" (
    "id" TEXT NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "legacyId" INTEGER,
    "description" TEXT,
    "imageKey" TEXT,
    "displayOnline" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VehicleTypeLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTypeLocation_legacyId_key" ON "VehicleTypeLocation"("legacyId");

-- CreateIndex
CREATE INDEX "VehicleTypeLocation_locationId_displayOnline_sortOrder_idx" ON "VehicleTypeLocation"("locationId", "displayOnline", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleTypeLocation_vehicleTypeId_locationId_key" ON "VehicleTypeLocation"("vehicleTypeId", "locationId");

-- AddForeignKey
ALTER TABLE "VehicleTypeLocation" ADD CONSTRAINT "VehicleTypeLocation_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleTypeLocation" ADD CONSTRAINT "VehicleTypeLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

