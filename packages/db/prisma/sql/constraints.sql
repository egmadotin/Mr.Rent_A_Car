-- Constraints Prisma can't express. Appended to the first migration
-- (prisma migrate dev --create-only, then paste this in).

-- Prevent double-booking a vehicle: no two blocks for the same vehicle may overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "VehicleBlock"
  ADD CONSTRAINT vehicle_block_no_overlap
  EXCLUDE USING gist ("vehicleId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&);

ALTER TABLE "VehicleBlock"
  ADD CONSTRAINT vehicle_block_valid_range CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT vehicle_block_one_owner CHECK (num_nonnulls("reservationId", "rentalId") = 1);

-- A charge line belongs to exactly one of quote / reservation / rental.
ALTER TABLE "ChargeLine"
  ADD CONSTRAINT charge_line_one_owner CHECK (num_nonnulls("quoteId", "reservationId", "rentalId") = 1);

-- Additional driver belongs to exactly one of reservation / rental.
ALTER TABLE "BookingDriver"
  ADD CONSTRAINT booking_driver_one_owner CHECK (num_nonnulls("reservationId", "rentalId") = 1);

-- Pickup/drop-off belongs to exactly one of reservation / rental.
ALTER TABLE "Transport"
  ADD CONSTRAINT transport_one_owner CHECK (num_nonnulls("reservationId", "rentalId") = 1);

-- Bill split belongs to exactly one of reservation / rental.
ALTER TABLE "BillSplit"
  ADD CONSTRAINT bill_split_one_owner CHECK (num_nonnulls("reservationId", "rentalId") = 1);
