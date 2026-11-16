-- Contract summary edits: the rental keeps its options grid as entered (incl. per-contract charge edits)
ALTER TABLE "Rental" ADD COLUMN "bookingOptions" JSONB;
