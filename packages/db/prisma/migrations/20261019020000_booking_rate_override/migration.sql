-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "rateOverride" JSONB;

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "rateOverride" JSONB;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "rateOverride" JSONB;

