-- Website Design V3, Widget/Rotator, Add/Edit Webpages, Claims Management V2, Point Of Sale
ALTER TYPE "LookupKind" ADD VALUE 'CLAIM_TYPE';
ALTER TYPE "LookupKind" ADD VALUE 'REPAIR_STATUS';

-- CreateTable
CREATE TABLE "WebsiteDesign" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "displaySkin" TEXT NOT NULL DEFAULT 'Default',
    "calendarSkin" TEXT NOT NULL DEFAULT 'Default',
    "backgroundImageKey" TEXT,
    "logoKey" TEXT,
    "compactWidth" INTEGER NOT NULL DEFAULT 0,
    "homePageBody" TEXT NOT NULL DEFAULT '',
    "headerHtml" TEXT NOT NULL DEFAULT '',
    "footerHtml" TEXT NOT NULL DEFAULT '',
    "stylesheet" TEXT NOT NULL DEFAULT '',
    "analyticsCode" TEXT NOT NULL DEFAULT '',
    "conversionCode" TEXT NOT NULL DEFAULT '',
    "widgetTarget" TEXT NOT NULL DEFAULT '_parent',
    "rotatorTarget" TEXT NOT NULL DEFAULT '_blank',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPage" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LINK',
    "target" TEXT NOT NULL DEFAULT '_parent',
    "url" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "internalClaimNumber" TEXT,
    "claimNumber" TEXT,
    "claimDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closeDate" TIMESTAMP(3),
    "repairLocationId" TEXT,
    "renterName" TEXT,
    "vehicleId" TEXT,
    "rentalNumber" TEXT,
    "dateOfLoss" TIMESTAMP(3),
    "claimType" TEXT,
    "insuranceCompanyId" TEXT,
    "stateOfIncident" TEXT,
    "vehicleLocationId" TEXT,
    "repairEstimate" DECIMAL(10,2),
    "statusOfRepair" TEXT,
    "demandSent" BOOLEAN NOT NULL DEFAULT false,
    "deductibleAmount" DECIMAL(10,2),
    "deductiblePaid" DECIMAL(10,2),
    "lossOfUse" DECIMAL(10,2),
    "diminishedValue" DECIMAL(10,2),
    "adjusterName" TEXT,
    "adjusterPhone" TEXT,
    "adjusterEmail" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosItem" (
    "id" TEXT NOT NULL,
    "itemNumber" TEXT,
    "description" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "memo" TEXT,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "locationId" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosOrder" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "poNumber" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payMethod" TEXT,
    "companyId" TEXT,
    "customerName" TEXT,
    "vehicleId" TEXT,
    "memo" TEXT,
    "locationId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salesTax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalSale" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "taxPercent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "amount" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PosOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaim_number_key" ON "InsuranceClaim"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PosOrder_number_key" ON "PosOrder"("number");

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_repairLocationId_fkey" FOREIGN KEY ("repairLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_vehicleLocationId_fkey" FOREIGN KEY ("vehicleLocationId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosItem" ADD CONSTRAINT "PosItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrderLine" ADD CONSTRAINT "PosOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PosOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrderLine" ADD CONSTRAINT "PosOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PosItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

