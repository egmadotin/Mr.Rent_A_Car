# Mr Rent A Car — rebuild status

**Updated:** October 21, 2026 (drivers in forms, inspections, file storage).

**What this compares:**
- Our new system: the ERP at `/admin` and the public website.
- RentCentric (`www8.rentcentric.com/Client6270`), menu by menu.

The RentCentric menus, vehicle page and customer page were re-read on Oct 20. Nothing was saved in RentCentric.

**Legend:**
- ✅ **Done:** built, matching RentCentric, and tested.
- 🟡 **Partly done:** works, with a gap that's noted.
- ⬜ **Not built yet.**
- 🔑 **Waiting on the client:** keys, accounts or samples needed.

---

## 1. Summary

| Area | Status |
|---|---|
| Quotes (list, add, edit, view, email, print) | ✅ |
| Reservations (list, add, edit, view, 14 actions, email, print) | ✅ |
| Rentals (list, start, edit, end, view, 23 actions, print, email) | ✅ |
| Contracts and invoices (templates, printouts, editor) | ✅ (Standard and Bill Split invoice 🔑) |
| Pricing (rates, seasons, taxes, insurance, misc charges, overrides) | ✅ Standard rate type exact; other rate types approximate |
| Customers (list, add, edit, view and its actions) | ✅ |
| Vehicles (list, add, edit, summary) | ✅ (every vehicle page action built) |
| Users, user groups and permissions | ✅ (group location limit not enforced) |
| Settings | 🟡 about 45 of RentCentric's ~100 setting pages built (section 7) |
| Reports | 🟡 29 of 64 built (see section 8) |
| Dashboard | ✅ |
| Public website and online booking | ✅ (customer login and fleet filters 🟡) |
| Email | ✅ built, 🔑 needs the client's email (SMTP) account |
| Card payments (Stripe) | ✅ built, 🔑 needs Stripe keys |
| Data migration from RentCentric | 🟡 setup data copied; customers / bookings history not yet |
| File storage (photos, documents) | ✅ staff-only `/api/files`; local disk (`.uploads/`) in dev, any S3-compatible bucket (AWS S3, Cloudflare R2 …) when `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` are set — to verify against the real bucket at deployment. New route: restart the server (start.bat) once to pick it up |
| Hosting / deployment | ⬜ |

---

## 2. Quotes

| RentCentric | Ours | Status |
|---|---|---|
| QuotesSearch (search, advanced search, list, delete) | `/admin/quotes` | ✅ |
| QuotesModify (add / edit) | `/admin/quotes/new`, `/[id]/edit` | ✅ |
| Rate (i) per-booking rate | Rate Details dialog | ✅ |
| Add/Edit Other Charges (4 lines) | options grid | ✅ |
| Quote view and actions | `/admin/quotes/[id]` | ✅ |
| Make reservation, Start rental | | ✅ |
| Email Quote | | ✅ 🔑 SMTP |
| SMS Quote | | 🟡 logs only; needs an SMS provider |
| Print Quote | `/admin/print/quotes/[id]`, editable template | ✅ |

## 3. Reservations

| RentCentric | Ours | Status |
|---|---|---|
| ReservationsSearch | `/admin/reservations` | ✅ |
| Reserve (Customer and Reservation tabs, payment panel, Check Matching) | `/admin/reservations/new`, `/[id]/edit` | ✅ |
| Rate (i), Other Charges, Add More Information | | ✅ |
| Add More Drivers inside the form | Drivers card on the Customer tab (search customers, add / remove); saved with the reservation; ticks the "Additional driver is added" charge × drivers | ✅ |
| ReservationMain: Start Rental | | ✅ |
| ReservationMain: Cancel, Delete, Move, Duplicate | | ✅ |
| ReservationMain: Payments/Charges | edit and delete payments added Oct 20 | ✅ |
| ReservationMain: Drivers, Bill Split, Pickup/Drop-off | | ✅ |
| Print Invoice, E-Mail Reservation | | ✅ 🔑 SMTP |
| Reservation Inspection | the reservation's inspections + Add Inspection (with photos) | ✅ |
| Confirmation email on save | | ✅ 🔑 SMTP |

## 4. Rentals

| RentCentric | Ours | Status |
|---|---|---|
| AgreementsSearch | `/admin/rentals` | ✅ |
| CheckOut3: Start a Rental | `/admin/rentals/new` | ✅ |
| CheckOut3: Edit Rental | `/[id]/edit` | ✅ |
| CheckIn2: End Rental | `/[id]/end` | ✅ |
| Rate (i), Other Charges, Add More Information, Upgrade, Fuel Charge | | ✅ |
| Add More Drivers inside the form | same Drivers card on Start / Edit Rental | ✅ |
| Credit Card (+) saved card | | 🔑 must go through Stripe |
| AgreementMain: Payments/Charges | including editing and deleting payments | ✅ |
| AgreementMain: Adjustments | including edit and delete | ✅ |
| AgreementMain: Commissions | including edit and delete | ✅ |
| AgreementMain: Traffic Tickets, Bill Split, Claims, Drivers | | ✅ |
| AgreementMain: Exchange Vehicle, Pickup/Drop-off, Memo and history | | ✅ |
| AgreementMain: Void, UnVoid, Reopen, Delete | | ✅ |
| Long-term invoices | | ✅ |
| Inspection Comparison | pickup vs return inspection photos for the rental, + the rental's inspections | ✅ |
| Capture / Refund on card payments | | 🔑 Stripe |
| Payment methods per location (YYC: Cheque, Direct Bill Company) | | ✅ |

## 5. Contracts, invoices and templates

| Item | Status |
|---|---|
| All 302 RentCentric templates copied (7 locations); 104 active | ✅ |
| Template editor with placeholder list and live preview | ✅ |
| Open Contract / Close Contract (matches the client's PDF; borders; one Letter page) | ✅ |
| Customer Invoice (rebuilt from the client's PDF) | ✅ |
| Reservation Confirmation, Print Quote | ✅ (not yet compared on screen with RentCentric) |
| Standard Invoice, Bill Split Invoice | 🔑 need a printed sample from the client |
| Email of agreements, reservations and quotes | ✅ 🔑 SMTP |
| Signature And Initials (Settings) | ✅ printed at ##Signature\<Code>## when its misc charge / insurance is (not) added, between its dates |

## 6. Vehicles

| RentCentric | Ours | Status |
|---|---|---|
| VehiclesSearch | `/admin/vehicles` | ✅ |
| VehicleAdd / VehicleSpecs (73 fields) | `/new`, `/[id]/edit` | ✅ |
| Vehicle page summary | `/admin/vehicles/[id]` | ✅ |
| **Vehicle page actions** | `/admin/vehicles/[id]` | ✅ Oct 20 (fields copied from each RentCentric form) |
| ↳ Insurances | | ✅ |
| ↳ Ownership Information | | ✅ Oct 21 (all 60 fields: purchase, finance / lease, owner, sale, title, depreciation) |
| ↳ Vehicle Condition | | ✅ Oct 21 (27 components × Excellent…Damaged, Special Comment 1-4 printed as VehicleConditionComment1-4) |
| ↳ Status Change, Vehicle History, Deactivate | | ✅ |
| ↳ Technical Log | | — RentCentric's own page is broken (Parser Error) |
| ↳ Maintenance, Problems, Repairs, Vehicle Services, Carwash | | ✅ |
| ↳ Damage (with Damage Locations / Conditions settings, photo), Accidents | | ✅ |
| ↳ Customer Reported Damages, Inspection Comparison, Vehicle Inspection | | ✅ Oct 21 — RentCentric only lists these (its apps fill them); ours adds an Add form with photos |
| ↳ Vehicle Checklist | | ✅ Oct 21 (checklists per vehicle type; items ticked + note per booking) |
| ↳ Vehicle Claims | | ✅ Oct 21 (the vehicle's own claims and its rentals' claims; New Claim with optional Rental #) |
| ↳ Rentals, Reservations (this vehicle's) | | ✅ |
| ↳ Notes, Images, Documents | | ✅ Oct 21 (Notes; Add More Images; Add More Documents with Description — PDF / Word / Excel / photos) |
| Fleet calendar | `/admin/calendar` | ✅ |

## 7. Settings

RentCentric's Settings menu, item by item.

### Location Information

| Item | Status |
|---|---|
| Locations | ✅ (now including legal name, GST number and fuel prices) |
| Hours Of Operation | ✅ |
| Customer Areas/Regions | ✅ |
| Offsite Locations | 🟡 offsite flag on each location |
| Add Location | ✅ |
| Upload Logo | ✅ per location; printed at ##LogoImage## (245 templates use it), inline so emails show it |

### Users

| Item | Status |
|---|---|
| Users | ✅ |
| User Groups | ✅ |

### Rates

| Item | Status |
|---|---|
| Master Rates | ✅ |
| Seasons | ✅ |
| Insurance Coverage | ✅ |
| Taxes | ✅ |
| Miscellaneous Charges | ✅ |
| Rental/Discount Reason | ✅ (two lists) |
| Rental Rates | ✅ RentCentric's "Rate Setup" menu page; our Settings › Rates group is the same menu |
| Master Rate Batch Update | ✅ Location / Rate Code / Season → grid per vehicle type; six Adjust rows (Percent % / Flat / Total) → Update Grid → Save |
| Rate Values Update | ⬜ |
| Rate Blocking | ⬜ |
| Rate Utilization | ⬜ |
| Rates Calendar | ⬜ |
| Overbooking Control | ⬜ |
| Rates Setup | ⬜ |
| One Way Rates | ✅ RentCentric's 49 rates copied; the fee is added as the "One Way" charge (taxed per each tax's One Way tick) on quotes, reservations, rentals and online bookings |
| One Way Regions | ✅ 8 regions copied, each location's region set (Surrey has none, as in RentCentric) |
| Pay Now Discounts | ⬜ |

### Company

| Item | Status |
|---|---|
| Companies / Corporates | ✅ |
| Company Type | ✅ |
| Partner Login Setup | ⬜ |

### Import Data and Other Tools

| Item | Status |
|---|---|
| Customer Import | ⬜ |
| Company Import | ⬜ |
| Rate Import | ⬜ |
| Reservation Import | ⬜ |
| Referral Import | ⬜ |
| Vehicle Import | ⬜ |
| Model Import | ⬜ |
| Copy Location Setup | ⬜ |
| Renew Rental Agreements | ⬜ |

### Payment Settings

| Item | Status |
|---|---|
| Internet Payment Gateway | ✅ Stripe |
| Payment Details | ✅ |
| Payment Methods | ✅ |
| Default Payment Method | ✅ |

### Rental Contracts & Invoices

| Item | Status |
|---|---|
| Rentals & Invoices, Add New | ✅ |
| Signature And Initials | ✅ |

### Vehicle Setup

| Item | Status |
|---|---|
| Makes, Models | ✅ |
| Types | ✅ |
| Body | ✅ |
| Options | ✅ |
| Category | ✅ |
| Engine Brand, Engine Type | ✅ |
| Fuel Types | ✅ extra list for the vehicle form; RentCentric has no menu item for it |
| Codes | ⬜ |
| Status | ⬜ |
| Groups | ⬜ |
| Damage Setup (Damage Locations, Damage Conditions) | ✅ |
| Title Locations | ⬜ |
| Registered Owners | ⬜ |
| SIPP Codes | ⬜ |
| Repair Order/Maintenance Program | ⬜ |
| Vehicle CheckList | ✅ |
| Vehicle CheckList Items | ✅ |

### Other setting groups

| Group | Item | Status |
|---|---|---|
| Tour Setup | Manage Tours, Customer Tours | ⬜ |
| Equipment Setup | Equipment Inventory | ✅ |
| Claims | Claims Management (V1 and V2) | ⬜ |
| Claims | Status Of Repair | ⬜ |
| Claims | Claim Types | ⬜ (claims themselves work on rentals) |
| Financial / Commission | Accounting | ⬜ |
| Financial / Commission | Commissions | ⬜ |
| Financial / Commission | Referrals | ✅ list, add, edit, deactivate; delete only when never used (fields as imported from RentCentric) |
| Financial / Commission | Commission Structures | ⬜ |
| Website & Email | Mail Server Configuration | ✅ |
| Website & Email | Reservation Email, Quote Email | 🟡 sent with the templates |
| Website & Email | Inspection Email | ✅ Subject + body; each inspection has an email button (details + photos attached) 🔑 SMTP |
| Website & Email | Promotions/Specials | ⬜ |
| Website & Email | Rental Policies | ⬜ |
| Website & Email | Configuration, Style & Format, Add/Edit Webpages | ⬜ (our public site replaces these) |
| Website & Email | Online Reservation (incl. V3, mobile), I-Frame Widget, I-Frame Rotator | ⬜ (our public site replaces these) |
| Website & Email | Merchandise Items, Orders | ⬜ |
| Email Marketing | Send Marketing Email, Email Template | ⬜ |
| Tasks & Messages | | ✅ My Tasks / Add Task / Tasks List (Email Task needs SMTP) |
| Paperless Counter, Counter Agent Pro, Mobile Scanner | | ⬜ (hardware / integrations phase) |

## 8. Reports

Built (29 of 64; same filters, columns and totals as RentCentric, 31-day limit on the daily ones): **Daily Business Report, Daily Cash Summary Report, Month to Date Report, Adjustment Details, Tasks List, Commissions, Revenue By Customer, Revenue By Vehicle, Revenue By Location, Revenue By Company, Rental Status, Reservation Manifest, Reservations No Showup/Cancelled, Rental Days, Rental Discount, Vehicle Due In, Vehicles Summary, Vehicle License Expiration, Vehicle Repairs, Vehicle Maintenance, Maintenance Alert, Checklist Overview, Customer List, Customer By Region, Traffic Tickets, Source Of Referral, Payments & Charges, Customer Notes, Undesired Customers** (`/admin/reports`).

Notes: rental discount changes are written to the rental's change log, which Rental Discount reads. Promo Code waits for Promotions/Specials (no promo codes in the system yet). Revenue By Rate opens a blank window in RentCentric (probably a file download) — to check.

Not built yet:

- **Management Reports:** Rental Details, Invoices, Rental Event Tracking, Reservation Event Tracking, Broker Commission, Sales Projection, Work In Process, Revenue By Rate, Revenue By Admin, Revenue By Options, Non-Revenue.
- **Rentals & Reservations:** Vehicle Rental Calendar, Corporate A/R By Bills, Customer A/R Report, Reservation A/R by Bills, Corporate A/R Analysis, Fleet Grid, Custom Reports, Reservation Forecast, Reservation Grid, Reservations Calendar, Dynamic Scheduler, Visual Scheduler, Promo Code.
- **Vehicles:** Vehicles Summary with QR Code, Vehicle Utilization (Today), Fleet Utilization History, Fleet Utilization For Cast, Vehicle Profit/Loss, Repair Orders, Vehicle Lease/Loan, Snap Shot For Rentals / Vehicle Type, Vehicle Insurance, KM Difference/Missing, Fleet Utilization Snapshot.

## 9. Dashboard

| RentCentric | Status |
|---|---|
| Status counts (In-fleet … No Show) | ✅ (they link to filtered lists, not RentCentric's detail pages) |
| Rentals Leaving Today / Returning Today lists | ✅ (overdue returns flagged) |
| My Tasks and Add Task | ✅ (`/admin/tasks`: My Tasks + Tasks List report) |
| Vehicles Requiring Service | ✅ from status and the "maintain every … km" interval; will use the last service entry once Maintenance is built |
| Rental Graph View (7 / 14 days / 1 month) | ✅ |
| Vehicle Availability check | ✅ |

## 10. Public website (mrrentacar.com)

| Item | Status |
|---|---|
| Home, About, Services, Locations, Fleet, Blogs, Contact | ✅ |
| Booking: dates and vehicle → options → details → confirmation, same prices as the live site | ✅ |
| Card at booking (Stripe) | ✅ 🔑 keys |
| Fleet filters | ✅ type (Car / SUV / Minivan / Van / Truck, from the class name), seats, bags, doors |
| Customer Login | ⬜ (ask the client) |

## 11. Waiting on the client

- Stripe test and live keys.
- Email (SMTP) account.
- SMS provider decision.
- Price master sheet.
- Printed samples of the Standard and Bill Split invoices.
- Customer Login: is it needed?
- Database hosting decision (Neon was planned).

## 12. Suggested order for what's left

1. ~~Vehicle page actions~~ (done Oct 20, except Ownership, Condition, inspections, checklist):
   - Maintenance, Repairs, Problems, Damage, Carwash, Status Change, History, Deactivate.
   - ~~Inspection and Customer Reported Damages~~ done Oct 21 (Reservation Inspection and rental Inspection Comparison with them); Checklist done Oct 21.
2. **Dashboard lists:** leaving and returning today, vehicles requiring service; the Tasks module.
3. **Core reports:**
   - Daily Business Report, Daily Cash Summary Report, Month to Date Report.
   - Reservation Manifest, Vehicle Due In, Rental Status.
   - Revenue reports, A/R reports.
4. ~~Payment Methods per location~~ (done Oct 20).
5. **Data migration:** customers, reservations and rental history.
6. **Deployment.**
7. **Remaining settings pages:** rate tools, one-way rates, claims settings and the rest, as the client needs them.
