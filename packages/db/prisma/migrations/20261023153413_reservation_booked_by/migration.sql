-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "bookedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bookedByUserId_fkey" FOREIGN KEY ("bookedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Online bookings made while logged in before this column existed: the account with the same email that existed when it was booked
UPDATE "Reservation" r SET "bookedByUserId" = u."id"
FROM "user" u, "Customer" c
WHERE r."customerId" = c."id" AND r."reservationChannel" = 'Website' AND r."bookedByUserId" IS NULL
  AND u."kind" = 'CUSTOMER' AND lower(u."email") = lower(c."email") AND r."createdAt" > u."createdAt";
