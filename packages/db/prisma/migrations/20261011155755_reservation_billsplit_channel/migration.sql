-- AlterTable
ALTER TABLE "BillSplit" ADD COLUMN     "reservationId" TEXT,
ALTER COLUMN "rentalId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "reservationChannel" TEXT;

-- AddForeignKey
ALTER TABLE "BillSplit" ADD CONSTRAINT "BillSplit_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bill split belongs to exactly one of reservation / rental.
ALTER TABLE "BillSplit"
  ADD CONSTRAINT bill_split_one_owner CHECK (num_nonnulls("reservationId", "rentalId") = 1);
