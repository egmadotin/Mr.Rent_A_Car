-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VehicleStatus" ADD VALUE 'ACCIDENT_REPLACEMENT';
ALTER TYPE "VehicleStatus" ADD VALUE 'COMPREHENSIVE';
ALTER TYPE "VehicleStatus" ADD VALUE 'FOR_SALE';
ALTER TYPE "VehicleStatus" ADD VALUE 'GROUNDED';
ALTER TYPE "VehicleStatus" ADD VALUE 'HAS_PROBLEM';
ALTER TYPE "VehicleStatus" ADD VALUE 'IN_CHECKOUT_PROCESS';
ALTER TYPE "VehicleStatus" ADD VALUE 'IN_REPAIR';
ALTER TYPE "VehicleStatus" ADD VALUE 'IN_SERVICE';
ALTER TYPE "VehicleStatus" ADD VALUE 'LEASED_REPLACEMENT';
ALTER TYPE "VehicleStatus" ADD VALUE 'OUT_OF_SERVICE';
ALTER TYPE "VehicleStatus" ADD VALUE 'SOLD';
ALTER TYPE "VehicleStatus" ADD VALUE 'STAFF';
ALTER TYPE "VehicleStatus" ADD VALUE 'STOLEN';

