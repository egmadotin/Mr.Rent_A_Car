-- Pay Now Discounts, Partner Login Setup
CREATE TABLE "PayNowDiscount" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "rateId" TEXT,
    "vehicleTypeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "applyOnMileage" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayNowDiscount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PayNowDiscount_locationId_idx" ON "PayNowDiscount"("locationId");

CREATE TABLE "PartnerLoginSetup" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "askForCreditCard" BOOLEAN NOT NULL DEFAULT false,
    "askForDriverLicense" BOOLEAN NOT NULL DEFAULT false,
    "askForFullAddress" BOOLEAN NOT NULL DEFAULT false,
    "askForBirthDate" BOOLEAN NOT NULL DEFAULT false,
    "askForFlightInfo" BOOLEAN NOT NULL DEFAULT false,
    "askForEmploymentInfo" BOOLEAN NOT NULL DEFAULT false,
    "askForCompanyInfo" BOOLEAN NOT NULL DEFAULT false,
    "askForInsuranceInfo" BOOLEAN NOT NULL DEFAULT false,
    "askForSsn" BOOLEAN NOT NULL DEFAULT false,
    "showDeliveryAddress" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "PartnerLoginSetup_pkey" PRIMARY KEY ("id")
);
