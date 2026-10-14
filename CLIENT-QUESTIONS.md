# Open questions for the client

Running list. None of these block the build. Fields are kept in the schema (marked `/// CONFIRM`)
until the client says otherwise; removing an unused column later is cheap.

## Fields kept pending confirmation

| Where | Field(s) | Question |
| --- | --- | --- |
| Customer | SSN | Is this collected? It's sensitive. If not needed, drop it. |
| Customer | PIN | What is the PIN used for? |
| Customer | Band Name | First Nations band name (tax-exempt rentals?). Still used? |
| Customer | All Vehicle Bodies | What does this checkbox control? |
| Customer | Check Yoti Verification | Is Yoti in use today? It affects the Plustek/Plaid plan. |
| Company | CURP, Folio | Mexican tax fields. Ever used? |
| Company | SSN, Partner Point ID | Still used? |
| Vehicle | 7 Plan ID fields (Subscription, Monthly, Yearly, Weekly/Monthly Low/High Mileage) | Which external system are these for? |
| Vehicle | Interior RGB, Exterior RGB, Stereo | Spec flags these as legacy. Keep or drop? (The live form labels Exterior RGB as a second "GVWR".) |
| Rate | Rentcars.com flag | Do they still sell through Rentcars.com? |
| Vehicle | "Service" dropdown | Empty on the live form. Not modelled yet. What was it for? |

## Locations

- Active in the new system: **Surrey, Coquitlam, YYC Calgary**. This matches the RentCentric switcher and what the client told us at kickoff.
- Kept as inactive/legacy so their history migrates: **Richmond, Burnaby, Vancouver Admin Office, YVR Airport Offsite**.
- The public site (mrrentacar.com/our-locations) still lists **Vancouver, Burnaby, Richmond, Surrey, YVR, Calgary** and does not list Coquitlam. Which list is correct, and should the new public site show only the three active locations?

## Integrations (future phase)

- Identity verification, licence/ID numbers and GPS position are entered by hand for now, as in the current ERP. Plustek/Plaid/Moovetrax will fill the same fields later.
- GPS position fields are **not** on the legacy vehicle form. They were added on our side so Moovetrax has a place to write. Confirm the client wants them visible to staff before then.

## Found while building (Oct 11–12)

- **Claims vs Claims V2**: the rental screen has both. Which one is in use? Only "Claims" is modelled.
- **Update Exchange Rate** (rental action): still used? Is it for US-dollar renters?
- **Online payment**: the public site takes no payment today (the booking becomes a tentative reservation). Keep it that way, or take a deposit online? Which processor (Stripe is the default)?
- **Contact form**: where should messages go (an email inbox, or a task/lead in the ERP)?
- **Promo codes**: the public widget collects one, but RentCentric's discount logic isn't known. Which codes exist, and what do they do?
- **Rate types**: only "Standard" (daily + hourly + grace minutes) is priced exactly. The ~70 legacy types (Multiday, N-Day Flat, Weekend, Min/Max …) need the client's real rate sheet to replicate.
- **Taxes by location**: assumed BC = GST + PST + PVRT $1.50/day, Calgary = GST only. Confirm.
- **Rental agreement / invoice templates**: Settings has customizable templates. Need copies of the current printed agreement and invoice.
- **Email / SMS provider** for Email Quote, SMS Quote, Email Agreement and Email Confirmation (all disabled in the UI until one is chosen).
- **Online vehicle classes**: the public site shows 14 classes (Standard, Full Size, Compact SUV …). Is that the list they want bookable online?
