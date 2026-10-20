-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "vehicleId" TEXT,
ALTER COLUMN "rentalId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- existing rental claims belong to the rental's vehicle
UPDATE "Claim" c SET "vehicleId" = r."vehicleId" FROM "Rental" r WHERE c."rentalId" = r."id" AND c."vehicleId" IS NULL;
