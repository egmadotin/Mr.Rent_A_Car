-- AlterTable
ALTER TABLE "EmailSettings" ADD COLUMN     "smsDashboardEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsDashboardMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "smsDashboardTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "smsNewResEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsNewResMessage" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "SmsNotificationUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT,
    "locationId" TEXT,
    "newReservation" BOOLEAN NOT NULL DEFAULT true,
    "realtimeDashboard" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsNotificationUser_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SmsNotificationUser" ADD CONSTRAINT "SmsNotificationUser_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

