-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LookupKind" ADD VALUE 'VEHICLE_GROUP';
ALTER TYPE "LookupKind" ADD VALUE 'TITLE_LOCATION';
ALTER TYPE "LookupKind" ADD VALUE 'REGISTERED_OWNER';
ALTER TYPE "LookupKind" ADD VALUE 'SIPP_CODE';

-- AlterTable
ALTER TABLE "VehicleModel" ADD COLUMN     "code" TEXT;

