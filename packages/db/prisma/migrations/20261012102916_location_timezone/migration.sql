-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'America/Vancouver';

UPDATE "Location" SET "timeZone"='America/Edmonton' WHERE id='loc_yyc';
