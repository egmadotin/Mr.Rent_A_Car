/** RentCentric "Rate Type" list (RatesModifyNew2.aspx; also the Rate Type filter on the rental search). */
export const RATE_TYPES = [
  "Standard",
  ...Array.from({ length: 30 }, (_, i) => `${i + 1} Day Multiday`),
  "5 Hour Flat", "Hourly Rate Only", "Daily Rate Only", "Weekly Rate Only", "Monthly Rate Only", "Weekend", "Min/Max Days", "Min/Max+Regular",
  ...Array.from({ length: 30 }, (_, i) => `${i + 1} Day Flat`),
];
