-- CreateTable
CREATE TABLE "VehicleCondition" (
    "vehicleId" TEXT NOT NULL,
    "ratings" JSONB NOT NULL DEFAULT '{}',
    "comment1" TEXT,
    "comment2" TEXT,
    "comment3" TEXT,
    "comment4" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCondition_pkey" PRIMARY KEY ("vehicleId")
);

-- AddForeignKey
ALTER TABLE "VehicleCondition" ADD CONSTRAINT "VehicleCondition_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

