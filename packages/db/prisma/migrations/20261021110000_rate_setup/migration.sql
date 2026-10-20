-- CreateTable
CREATE TABLE "RateSetup" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "daysInMonth" INTEGER NOT NULL DEFAULT 30,
    "hourlyRatio" DECIMAL(10,4) NOT NULL DEFAULT 0.19,
    "extraDailyRatio" DECIMAL(10,4) NOT NULL DEFAULT 1.3,
    "weeklyRatio" DECIMAL(10,4) NOT NULL DEFAULT 7,
    "monthlyRatio" DECIMAL(10,4) NOT NULL DEFAULT 30,

    CONSTRAINT "RateSetup_pkey" PRIMARY KEY ("id")
);


-- RentCentric Rates Setup (same at every location)
INSERT INTO "RateSetup" ("id") VALUES ('default');
