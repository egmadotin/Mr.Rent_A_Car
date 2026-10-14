-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "email" TEXT,
ADD COLUMN     "excludedTaxIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "excludedTaxIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "excludedTaxIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

