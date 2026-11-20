-- Settings > Self Service & Car Share SetUp
CREATE TABLE "SelfServiceSetup" (
    "locationId" TEXT NOT NULL,
    "rental" JSONB NOT NULL DEFAULT '{}',
    "welcomeEmail" JSONB,
    "registrationEmail" JSONB,
    "welcomeSms" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SelfServiceSetup_pkey" PRIMARY KEY ("locationId")
);
ALTER TABLE "SelfServiceSetup" ADD CONSTRAINT "SelfServiceSetup_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
