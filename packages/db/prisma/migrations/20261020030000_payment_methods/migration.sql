-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "defaultPaymentMethod" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "methodName" TEXT;

-- CreateTable
CREATE TABLE "LocationPaymentMethod" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCreditCard" BOOLEAN NOT NULL DEFAULT false,
    "creditCardType" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "mobileAgentIncluded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationPaymentMethod_locationId_name_key" ON "LocationPaymentMethod"("locationId", "name");

-- AddForeignKey
ALTER TABLE "LocationPaymentMethod" ADD CONSTRAINT "LocationPaymentMethod_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

