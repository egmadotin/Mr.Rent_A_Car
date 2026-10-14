-- CreateTable
CREATE TABLE "LocationTax" (
    "locationId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,

    CONSTRAINT "LocationTax_pkey" PRIMARY KEY ("locationId","taxId")
);

-- AddForeignKey
ALTER TABLE "LocationTax" ADD CONSTRAINT "LocationTax_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationTax" ADD CONSTRAINT "LocationTax_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE CASCADE ON UPDATE CASCADE;
