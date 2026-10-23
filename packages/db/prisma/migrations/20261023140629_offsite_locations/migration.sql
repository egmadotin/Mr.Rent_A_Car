-- CreateTable
CREATE TABLE "OffsiteLocation" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "locationId" TEXT NOT NULL,
    "parkingSymbol" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contactName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT DEFAULT 'Canada',
    "postal" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "regionId" TEXT,
    "latitude" DECIMAL(10,6),
    "longitude" DECIMAL(11,6),
    "boundary" JSONB,
    "parkingType" TEXT,
    "parkingExplanation" TEXT,
    "memo" TEXT,
    "imageKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "useOneWay" BOOLEAN NOT NULL DEFAULT false,
    "webCustomer" BOOLEAN NOT NULL DEFAULT false,
    "isPrivateProperty" BOOLEAN NOT NULL DEFAULT false,
    "taxIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffsiteLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OffsiteLocation_legacyId_key" ON "OffsiteLocation"("legacyId");

-- AddForeignKey
ALTER TABLE "OffsiteLocation" ADD CONSTRAINT "OffsiteLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RentCentric's offsite location (Richmond): (O) Mr Rent A Car Edmonton Off-Site
INSERT INTO "OffsiteLocation" ("id", "legacyId", "locationId", "parkingSymbol", "name", "code", "contactName", "address", "city", "province", "country", "postal", "phone", "fax", "email", "regionId", "latitude", "longitude", "parkingType", "isActive", "useOneWay", "updatedAt")
SELECT 'offsite_123', 123, l."id", '(O)', 'Mr Rent A Car Edmonton Off-Site', 'YEG', 'Vincent', 'Airport Perimeter Road', 'Edmonton', 'Alberta', 'Canada', 'T9E 0V6', '604.303.0063', '604.303.0095', 'info@mrrentacar.com',
  (SELECT "id" FROM "Lookup" WHERE "kind" = 'CUSTOMER_REGION' AND "name" = 'Richmond' LIMIT 1), 53.31069, NULL, 'On-Street', true, true, NOW()
FROM "Location" l WHERE l."legacyId" = 116
ON CONFLICT DO NOTHING;
