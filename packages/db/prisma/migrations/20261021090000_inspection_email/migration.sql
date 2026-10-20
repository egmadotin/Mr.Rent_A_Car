-- AlterTable
ALTER TABLE "EmailSettings" ADD COLUMN     "inspectionBody" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "inspectionSubject" TEXT NOT NULL DEFAULT 'Inspection Info';

