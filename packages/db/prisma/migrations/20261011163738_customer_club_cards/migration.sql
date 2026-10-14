-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ipAddress" TEXT;

-- AlterTable
ALTER TABLE "CreditCard" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ClubMembership" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "gCode" TEXT,
    "cardNumber" TEXT,
    "issuedAt" DATE,
    "expiresAt" DATE,
    "sentAt" DATE,
    "status" TEXT,

    CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClubMembership_customerId_key" ON "ClubMembership"("customerId");

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
