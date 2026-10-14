-- AlterTable
ALTER TABLE "VehicleType" ADD COLUMN     "airConditioner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alwaysAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "deposit" DECIMAL(10,2),
ADD COLUMN     "depositRequiredAtReservation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depositType" TEXT,
ADD COLUMN     "effectiveDate" DATE,
ADD COLUMN     "endDate" DATE,
ADD COLUMN     "largeBags" INTEGER,
ADD COLUMN     "minimumAge" INTEGER,
ADD COLUMN     "smallBags" INTEGER,
ADD COLUMN     "specUrl" TEXT,
ADD COLUMN     "transmission" TEXT,
ADD COLUMN     "videoUrl" TEXT;

