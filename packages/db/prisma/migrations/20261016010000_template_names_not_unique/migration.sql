-- DropIndex
DROP INDEX "DocumentTemplate_locationId_name_kind_key";

-- CreateIndex
CREATE INDEX "DocumentTemplate_locationId_kind_idx" ON "DocumentTemplate"("locationId", "kind");

