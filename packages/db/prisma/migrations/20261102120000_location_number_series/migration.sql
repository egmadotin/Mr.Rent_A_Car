-- Number Series: each location's own starting number for quotes, reservations and rental agreements
ALTER TABLE "Location" ADD COLUMN "quoteNumberStart" INTEGER;
ALTER TABLE "Location" ADD COLUMN "reservationNumberStart" INTEGER;
ALTER TABLE "Location" ADD COLUMN "rentalNumberStart" INTEGER;
