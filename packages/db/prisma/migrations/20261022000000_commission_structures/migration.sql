-- AlterTable
ALTER TABLE "user" ADD COLUMN     "commissionAmount" DECIMAL(10,2),
ADD COLUMN     "commissionStructureIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "commissionType" "DiscountType";

-- CreateTable
CREATE TABLE "CommissionStructure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationId" TEXT,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionStructure_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CommissionStructure" ADD CONSTRAINT "CommissionStructure_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RentCentric's one Commission Structure ("coquitlam", Coquitlam): 25% to the agent who opens and 25% to the agent
-- who closes the rental, on Net Rate, Mileage, Prepaid Fuel and the Additional Driver charge (copied Oct 22)
INSERT INTO "CommissionStructure" ("id","name","locationId","rules")
SELECT 'cs_coquitlam','coquitlam',(SELECT "id" FROM "Location" WHERE "legacyId"=119),
'{"NET_RATE":{"open":{"amount":25,"type":"PERCENT"},"close":{"amount":25,"type":"PERCENT"}},"MILEAGE":{"open":{"amount":25,"type":"PERCENT"},"close":{"amount":25,"type":"PERCENT"}},"PREPAID_FUEL":{"open":{"amount":25,"type":"PERCENT"},"close":{"amount":25,"type":"PERCENT"}},"MISC:Additional Driver":{"open":{"amount":25,"type":"PERCENT"},"close":{"amount":25,"type":"PERCENT"}}}'::jsonb;
