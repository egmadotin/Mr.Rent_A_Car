-- AlterEnum
ALTER TYPE "LookupKind" ADD VALUE 'PAYMENT_DETAIL';

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "email" TEXT,
ADD COLUMN     "fax" TEXT,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "memo" TEXT,
ADD COLUMN     "phone" TEXT;

