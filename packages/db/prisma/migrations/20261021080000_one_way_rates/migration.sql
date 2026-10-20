-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "oneWayRegionId" TEXT;

-- CreateTable
CREATE TABLE "OneWayRegion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "OneWayRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneWayRate" (
    "id" TEXT NOT NULL,
    "fromRegionId" TEXT NOT NULL,
    "toRegionId" TEXT NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL,
    "odometer" INTEGER,
    "numberOfDays" INTEGER,
    "vehicleTypeId" TEXT,
    "competitionRate1" DECIMAL(10,2),
    "competitionRate2" DECIMAL(10,2),
    "competitionRate3" DECIMAL(10,2),
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "memo" TEXT,

    CONSTRAINT "OneWayRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OneWayRegion_name_key" ON "OneWayRegion"("name");

-- CreateIndex
CREATE INDEX "OneWayRate_fromRegionId_toRegionId_idx" ON "OneWayRate"("fromRegionId", "toRegionId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_oneWayRegionId_fkey" FOREIGN KEY ("oneWayRegionId") REFERENCES "OneWayRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneWayRate" ADD CONSTRAINT "OneWayRate_fromRegionId_fkey" FOREIGN KEY ("fromRegionId") REFERENCES "OneWayRegion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneWayRate" ADD CONSTRAINT "OneWayRate_toRegionId_fkey" FOREIGN KEY ("toRegionId") REFERENCES "OneWayRegion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneWayRate" ADD CONSTRAINT "OneWayRate_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RentCentric's One Way Regions, each location's region, and its 49 One Way Rates (copied Oct 21)
INSERT INTO "OneWayRegion" ("id","name") VALUES ('owr_burnaby','Burnaby'),('owr_calgary','Calgary'),('owr_coquitlam','Coquitlam'),('owr_richmond','Richmond'),('owr_vancouver','Vancouver'),('owr_yeg','YEG'),('owr_yvr','YVR'),('owr_yyc','YYC');
UPDATE "Location" SET "oneWayRegionId"='owr_richmond' WHERE "legacyId"=116;
UPDATE "Location" SET "oneWayRegionId"='owr_burnaby' WHERE "legacyId"=117;
UPDATE "Location" SET "oneWayRegionId"='owr_vancouver' WHERE "legacyId"=118;
UPDATE "Location" SET "oneWayRegionId"='owr_coquitlam' WHERE "legacyId"=119;
UPDATE "Location" SET "oneWayRegionId"='owr_yyc' WHERE "legacyId"=120;
UPDATE "Location" SET "oneWayRegionId"='owr_yvr' WHERE "legacyId"=126;
INSERT INTO "OneWayRate" ("id","fromRegionId","toRegionId","fee","startDate","endDate") VALUES ('owrate_1','owr_burnaby','owr_richmond',35,'2000-01-01','2031-12-31'),('owrate_2','owr_burnaby','owr_vancouver',50,'2000-01-01','2031-12-31'),('owrate_3','owr_burnaby','owr_yvr',50,'2000-01-01','2031-12-31'),('owrate_4','owr_burnaby','owr_coquitlam',15,'2000-01-01','2030-12-31'),('owrate_5','owr_burnaby','owr_yyc',795,'2026-06-01','2030-09-15'),('owrate_6','owr_burnaby','owr_yyc',795,'2025-09-15','2026-03-14'),('owrate_7','owr_burnaby','owr_yyc',595,'2026-03-14','2026-06-01'),('owrate_8','owr_coquitlam','owr_yyc',450,'2025-01-01','2025-05-31'),('owrate_9','owr_coquitlam','owr_richmond',50,'2000-01-01','2031-12-31'),('owrate_10','owr_coquitlam','owr_yyc',650,'2025-06-01','2031-12-31'),('owrate_11','owr_coquitlam','owr_yvr',75,'2000-01-01','2030-12-31'),('owrate_12','owr_coquitlam','owr_burnaby',15,'2000-01-01','2030-12-31'),('owrate_13','owr_coquitlam','owr_vancouver',50,'2000-01-01','2030-12-31'),('owrate_14','owr_richmond','owr_burnaby',35,'2000-01-01','2031-12-31'),('owrate_15','owr_richmond','owr_vancouver',75,'2000-01-01','2031-12-31'),('owrate_16','owr_richmond','owr_yvr',15,'2000-01-01','2031-12-31'),('owrate_17','owr_richmond','owr_coquitlam',50,'2000-01-01','2031-12-31'),('owrate_18','owr_richmond','owr_yyc',795,'2025-09-15','2026-03-14'),('owrate_19','owr_richmond','owr_yyc',595,'2026-03-14','2026-06-01'),('owrate_20','owr_richmond','owr_yyc',795,'2026-06-01','2030-12-31'),('owrate_21','owr_vancouver','owr_yyc',595,'2026-03-14','2026-06-01'),('owrate_22','owr_vancouver','owr_yyc',350,'2025-09-15','2026-03-14'),('owrate_23','owr_vancouver','owr_richmond',75,'2000-01-01','2031-12-31'),('owrate_24','owr_vancouver','owr_burnaby',50,'2000-01-01','2031-12-31'),('owrate_25','owr_vancouver','owr_yvr',75,'2000-01-01','2030-12-31'),('owrate_26','owr_vancouver','owr_yyc',795,'2026-06-01','2030-09-15'),('owrate_27','owr_vancouver','owr_coquitlam',50,'2000-01-01','2030-12-31'),('owrate_28','owr_yvr','owr_coquitlam',75,'2000-01-01','2030-12-31'),('owrate_29','owr_yvr','owr_vancouver',75,'2000-01-01','2030-12-31'),('owrate_30','owr_yvr','owr_yyc',795,'2026-06-01','2030-09-15'),('owrate_31','owr_yvr','owr_burnaby',35,'2000-01-01','2030-12-31'),('owrate_32','owr_yvr','owr_richmond',15,'2000-01-01','2031-12-31'),('owrate_33','owr_yvr','owr_yyc',350,'2025-09-15','2026-03-14'),('owrate_34','owr_yvr','owr_yyc',595,'2026-03-14','2026-06-01'),('owrate_35','owr_yyc','owr_burnaby',595,'2026-03-14','2026-06-01'),('owrate_36','owr_yyc','owr_richmond',595,'2026-03-14','2026-06-01'),('owrate_37','owr_yyc','owr_vancouver',595,'2026-03-14','2026-06-01'),('owrate_38','owr_yyc','owr_yvr',595,'2026-03-14','2026-06-01'),('owrate_39','owr_yyc','owr_yvr',350,'2025-10-01','2026-03-14'),('owrate_40','owr_yyc','owr_vancouver',350,'2025-10-01','2026-03-14'),('owrate_41','owr_yyc','owr_richmond',350,'2025-10-01','2026-03-14'),('owrate_42','owr_yyc','owr_coquitlam',350,'2025-10-01','2026-03-14'),('owrate_43','owr_yyc','owr_burnaby',350,'2025-10-01','2026-03-14'),('owrate_44','owr_yyc','owr_yeg',500,'2025-01-01','2026-12-31'),('owrate_45','owr_yyc','owr_coquitlam',795,'2025-06-01','2030-10-01'),('owrate_46','owr_yyc','owr_richmond',795,'2026-06-01','2030-10-01'),('owrate_47','owr_yyc','owr_yvr',795,'2026-06-01','2030-10-01'),('owrate_48','owr_yyc','owr_burnaby',795,'2026-06-01','2030-10-01'),('owrate_49','owr_yyc','owr_vancouver',795,'2026-06-01','2030-10-01');
