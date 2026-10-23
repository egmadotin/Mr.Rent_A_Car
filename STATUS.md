# Mr Rent A Car — rebuild status

**Updated:** October 21, 2026 (drivers in forms, inspections, file storage, vehicle page complete, one way rates, promo codes, more settings).

**What this compares:**
- Our new system: the ERP at `/admin` and the public website.
- RentCentric (`www8.rentcentric.com/Client6270`), menu by menu.

The RentCentric menus, vehicle page and customer page were re-read on Oct 20. Nothing was saved in RentCentric.

**Legend:**
- ✅ **Done:** built, matching RentCentric, and tested.
- 🟡 **Partly done:** works, with a gap that's noted.
- ⬜ **Not built yet.**
- ⏸ **Not in use in RentCentric** (no data): left out unless the client wants it.
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
| Users, user groups and permissions | ✅ RentCentric's 3 user groups (Counter, Junior Admin, Supervisor) added to every database by migration. **Location Access** per user (Settings › Users: tick the branches; none = the group's location, else all; Full Admins: all): the sidebar picker lists only those branches, and Quotes / Reservations / Rentals lists, opening a booking, and creating / editing / starting one are limited to them (checked on the server). **Per-user permissions** (Settings › Users › Permissions, as RentCentric's user form): every permission ticked as the user's group has it; tick extra ones or untick some for just that user (marked + / −; "Use group's permissions" resets); stored as changes from the group, so later group edits still apply. Fixed: users added in Settings › Users couldn't sign in (login saved under the wrong account id); existing ones repaired by migration. Screens follow permissions: sidebar items (Quotes, Reservations, Rentals, Vehicles, Customers, Reports) and the New menu show only what the user may use; Add / Edit / Delete / Start rental / Reserve buttons are hidden without the permission; opening a screen without it shows "No access". Reports now also need the Reports permission on the server |
| Settings | 🟡 about 64 of RentCentric's ~100 setting pages built (section 7) |
| Reports | ✅ 63 of 64 built; Repair Orders not in use (see section 8) |
| Dashboard | ✅ |
| Public website and online booking | ✅ (customer login and fleet filters 🟡) |
| Email | ✅ built, 🔑 needs the client's email (SMTP) account |
| Card payments (Stripe) | ✅ built, 🔑 needs Stripe keys |
| Data migration from RentCentric | 🟡 setup data copied; customers / bookings history not yet. `sync-data.bat` copies the local setup data + the 23 RentCentric vehicles to the live server (no customers, bookings or test records; live database backed up first, then replaced) |
| File storage (photos, documents) | ✅ staff-only `/api/files`; local disk (`.uploads/`) in dev, any S3-compatible bucket (AWS S3, Cloudflare R2 …) when `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` are set — to verify against the real bucket at deployment. New route: restart the server (start.bat) once to pick it up |
| Hosting / deployment | 🟡 production Docker setup + deploy.bat ready (VPS 145.223.18.134, port 3100, pulls from GitHub via a read-only deploy key — key to add on GitHub); the client deploys. kawa stopped and archived in /opt/platform/archive |

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
| Offsite Locations | ✅ per location (`/admin/settings/offsite-locations`): list (Location Name, Contact, Phone, Address, Active) and RentCentric's form (parking symbol, code, contact, address, region, lat / lon, parking, memo, active, one way, online booking, private property, taxes). RentCentric's one offsite copied: (O) Mr Rent A Car Edmonton Off-Site (YEG) under Richmond. Not yet offered as a pick-up / return point on bookings |
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
| Rate Values Update | ⏸ not in use: RentCentric's Rates Calendar shows no day-by-day prices — build if the client wants yield pricing |
| Rate Blocking | ⏸ not in use (as above) |
| Rate Utilization | ⏸ not in use (as above) |
| Rates Calendar | ⏸ not in use (as above) |
| Overbooking Control | ⏸ not in use (as above) |
| Rates Setup | ✅ #Days in Month + Rate Ratios (copied: 30; 0.19 / 1.3 / 7 / 30); entering a Daily price on a rate fills its empty Hourly / Extra daily / Weekly / Monthly |
| One Way Rates | ✅ RentCentric's 49 rates copied; the fee is added as the "One Way" charge (taxed per each tax's One Way tick) on quotes, reservations, rentals and online bookings |
| One Way Regions | ✅ 8 regions copied, each location's region set (Surrey has none, as in RentCentric) |
| Pay Now Discounts | ⏸ none set up in RentCentric |

### Company

| Item | Status |
|---|---|
| Companies / Corporates | ✅ |
| Company Type | ✅ |
| Partner Login Setup | ⏸ not set up in RentCentric (all "Ask for" boxes unticked): the partner booking portal isn't used |

### Import Data and Other Tools

| Item | Status |
|---|---|
| Customer Import | ✅ RentCentric's CSV template (card columns ignored — never stored) |
| Company Import | ✅ |
| Rate Import | ✅ one row per rate code + vehicle type |
| Reservation Import | ⬜ part of the data migration (bookings with their charges) |
| Referral Import | ✅ |
| Vehicle Import | ✅ makes / models created when new |
| Model Import | ✅ (Make, Model) |
| Copy Location Setup | ✅ insurances, misc charges, taxes (apply-to rules re-pointed), rates with prices, payment methods, rental forms, vehicle types, hours — only what the destination lacks; the other RentCentric items are shared by all locations here |
| Renew Rental Agreements | ⏸ RentCentric's own page is broken (server compile error) |

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
| Codes | ✅ Model Code on each model (Makes & Models); RentCentric's one code (SV = Versa Note) copied |
| Status | ✅ the 17 statuses (fixed: rentals and availability rely on them) |
| Groups | ✅ (empty in RentCentric) |
| Damage Setup (Damage Locations, Damage Conditions) | ✅ |
| Title Locations | ✅ (empty in RentCentric; offered on Ownership Information) |
| Registered Owners | ✅ (empty in RentCentric; offered on Ownership Information) |
| SIPP Codes | ✅ RentCentric's 43 codes copied |
| Repair Order/Maintenance Program | ⏸ no repair orders or programs in RentCentric (vehicle Repairs and Maintenance are built) |
| Vehicle CheckList | ✅ |
| Vehicle CheckList Items | ✅ |

### Other setting groups

| Group | Item | Status |
|---|---|---|
| Tour Setup | Manage Tours, Customer Tours | ⏸ not in use in RentCentric |
| Equipment Setup | Equipment Inventory | ✅ |
| Claims | Claims Management | ✅ every claim on rentals and vehicles (status / date / claim # filters) |
| Claims | Claims Management V2 | ⏸ no V2 claims in RentCentric |
| Claims | Status Of Repair | ⏸ empty in RentCentric |
| Claims | Claim Types | ⏸ empty in RentCentric (claims use Renter / 3rd Party / Other) |
| Financial / Commission | Accounting | ⏸ GL Account Codes all empty in RentCentric (no accounting export used) |
| Financial / Commission | Financial Settings | ✅ RentCentric's link opens its Referrals page (built) |
| Financial / Commission | Commissions | ✅ every commission entered on rentals (Rental#, Amount, Date Entered, Referral, User, Entered By, Delete) |
| Financial / Commission | Referrals | ✅ list, add, edit, deactivate; delete only when never used (fields as imported from RentCentric) |
| Financial / Commission | Commission Structures | ✅ RentCentric's structure copied (coquitlam: 25% open + 25% close on Net Rate, Mileage, Prepaid Fuel, Additional Driver); agents get structures + a Commission type/amount on Settings › Users; the Commissions report adds what they earn |
| Website & Email | Mail Server Configuration | ✅ |
| Website & Email | Reservation Email | ✅ per location (+ Use For All Locations): From Name / Email, To Email (a copy to staff), HTML/Text, Subject, optional body (empty = the Reservation Confirmation template), Identity Verification URL; RentCentric's settings copied (as at Surrey). Sent on every online booking (a failure is noted on the reservation) and by Send Confirmation Email 🔑 SMTP. Reservation / rental renewal reminders: ⏸ off in RentCentric |
| Website & Email | Quote Email | ✅ RentCentric's Subject and body copied (its web-email codes: ##QuoteNumber##, ##PickupDate##, ##ChargesSummary##, ##LocationLogo## …); Email Quote sends it (empty body = the Quote template) 🔑 SMTP |
| Website & Email | Inspection Email | ✅ Subject + body; each inspection has an email button (details + photos attached) 🔑 SMTP |
| Website & Email | Promotions/Specials | ✅ RentCentric's 9 codes copied (locations + vehicle types); a valid code on an online booking becomes its discount (dates, minimum days, location, vehicle type, one-time use checked). Promo Code report built |
| Website & Email | Rental Policies | ✅ RentCentric's Master Policies copied (same text for every location); shown on the online booking's last step above "I accept the rental policy"; editable with a preview (`/admin/settings/rental-policies`). New route: restart the server once |
| Website & Email | Configuration, Style & Format, Add/Edit Webpages | ⬜ (our public site replaces these) |
| Website & Email | Online Reservation (incl. V3, mobile), I-Frame Widget, I-Frame Rotator | ⬜ (our public site replaces these) |
| Website & Email | Merchandise Items, Orders | ⏸ not in use in RentCentric |
| Email Marketing | Send Marketing Email | ✅ RentCentric's 7 "Select Email" groups (all customers, birthdays in a day/month range, new customers, by location, confirmed reservations, on rent, closed rentals), From Name / Email, Text or Html, Subject, attachment (5 MB), "Allow Customer To Unsubscribe" (signed link → `/unsubscribe`, ticks the customer's "Unsubscribed from email marketing"); shows the recipient count first; unsubscribed / no-email customers left out; 2,000 per send 🔑 SMTP. New routes: restart the server once |
| Email Marketing | Email Template | ⏸ none in RentCentric (the template list is empty) |
| Tasks & Messages | | ✅ My Tasks / Add Task / Tasks List (Email Task needs SMTP) |
| Paperless Counter, Counter Agent Pro, Mobile Scanner | | ⬜ (hardware / integrations phase) |

## 8. Reports

Built (63 of 64; same filters, columns and totals as RentCentric, 31-day limit on the daily ones): **Daily Business Report, Daily Cash Summary Report, Month to Date Report, Rental Details, Adjustment Details, Invoices, Rental Event Tracking, Reservation Event Tracking, Tasks List, Commissions, Broker Commission, Sales Projection, Work In Process, Revenue By Customer, Revenue By Vehicle, Revenue By Location, Revenue By Rate, Revenue By Admin, Revenue By Company, Revenue By Options, Non-Revenue, Rental Status, Reservation Manifest, Vehicle Rental Calendar, Corporate A/R By Bills, Customer A/R Report, Reservation A/R by Bills, Corporate A/R Analysis, Fleet Grid, Custom Reports, Reservation Forecast, Reservation Grid, Reservations No Showup/Cancelled, Reservations Calendar, Dynamic Scheduler, Visual Scheduler, Promo Code, Rental Days, Rental Discount, Vehicle Due In, Vehicles Summary, Vehicles Summary with QR Code, Vehicle Utilization (Today), Fleet Utilization History, Fleet Utilization For Cast, Vehicle License Expiration, Vehicle Profit/Loss, Vehicle Repairs, Vehicle Lease/Loan, Vehicle Maintenance, Maintenance Alert, Snap Shot For Rentals / Vehicle Type, Vehicle Insurance, KM Difference/Missing, Fleet Utilization Snapshot, Checklist Overview, Customer List, Customer By Region, Traffic Tickets, Source Of Referral, Payments & Charges, Customer Notes, Undesired Customers** (`/admin/reports`).

Notes: rental discount changes are written to the rental's change log, which Rental Discount reads. Promo Code lists reservations booked with a code (Settings › Promotions/Specials). Revenue By Rate groups by rate code with Hourly / Daily / Extra Daily / Weekly / Monthly time charges. A/R reports: a company's amount due is its Bill Split; payments marked as from that company count against it. Fleet Utilization For Cast, Fleet Grid and Reservation Forecast come back empty in RentCentric even for upcoming days, so ours are vehicle type × day projections — For Cast: fleet / on rent / reserved / available; Fleet Grid: fleet − on rent − reserved (reservations reduced by the No Show %); Reservation Grid: reservations out each day; Reservation Forecast: pickups / returns per day ("By Reservation" lists them) — to check with the client. Snap Shot's Contract Type filter (Regular / Cash Customer / Direct Bill / Insurance Replacement / Loaner / Warranty) is not built: rentals have no contract type field yet. Vehicles Summary with QR Code: each vehicle's QR encodes its Assigned ID. Vehicle Rental Calendar is a chart in RentCentric; ours is a vehicle × day grid with the rental # on each day. Reservations Calendar: a month-style calendar of pickups. Visual Scheduler and Dynamic Scheduler open the fleet calendar (/admin/calendar); Custom Reports holds only Mr Rent A Car's custom Daily Business Report, so it opens ours. Repair Orders is left out with the Repair Order program (not in use).

Not built yet:

- **Vehicles:** Repair Orders — ⏸ not in use (no repair orders in RentCentric).

## 9. Dashboard

| RentCentric | Status |
|---|---|
| Status counts (In-fleet … No Show) | ✅ (they link to filtered lists, not RentCentric's detail pages) |
| Rentals Leaving Today / Returning Today lists | ✅ (overdue returns flagged) |
| My Tasks and Add Task | ✅ moved off the dashboard to its own sidebar item, **My Tasks** (`/admin/tasks`: My Tasks + Tasks List). Add Task only for admins and user groups with the new **Tasks › Add Task** permission (Settings › User Groups), checked on the server too |
| Vehicles Requiring Service | ⏸ removed from the dashboard at the client's request |
| Rental Graph View (7 / 14 days / 1 month) | ✅ |
| Advanced dashboard (beyond RentCentric) | ✅ quick actions; KPIs: revenue month to date vs the same days last month (with a 30-day sparkline), fleet utilization, average daily rate / rental length / collected, balance owing; live status strip; revenue last 30 days chart; fleet status mix; Today's operations (pick-ups / returns / overdue tabs); booking pipeline (next 7 / 30 days, confirmed vs tentative, online, quotes); utilization forecast chart; vehicle types (utilization + revenue MTD); locations (vehicles on rent / assigned to each branch); latest bookings; refreshes every 2 minutes. Vehicle Availability removed at the client's request |
| Vehicle Availability check | ⏸ removed from the dashboard at the client's request |

## 10. Public website (mrrentacar.com)

| Item | Status |
|---|---|
| Home, About, Services, Locations, Fleet, Blogs, Contact | ✅ |
| Booking bar (home / results): Pick-up and Drop-off location (Drop-off defaults to "Same as pick-up") | ✅ |
| Booking: dates and vehicle → options → details → confirmation, same prices as the live site | ✅ (home hero bar and results bar: Pick-up + Drop-off location, "Same as pick-up" by default; a different drop-off adds the one-way fee) |
| Card at booking (Stripe) | ✅ 🔑 keys |
| Fleet filters | ✅ type (Car / SUV / Minivan / Van / Truck, from the class name), seats, bags, doors |
| Customer Login | ⬜ (ask the client) |

## 11. Waiting on the client

- Which staff earn by the "coquitlam" commission structure (RentCentric's user list couldn't be read; tick it on each user in Settings › Users).

- Not in use in RentCentric (left out unless wanted): Tours, Claims Management V2, Status Of Repair, Claim Types, Merchandise Items / Orders, Email Templates, Repair Order program.

- Yield pricing (Rate Values Update, Rate Blocking, Rate Utilization, Rates Calendar, Overbooking Control): not used in RentCentric today — needed?

- Stripe test and live keys.
- Email (SMTP) account.
- SMS provider decision.
- Price master sheet.
- Printed samples of the Standard and Bill Split invoices.
- Customer Login: is it needed?
- Database hosting decision (Neon was planned).

## Next session (Oct 22)

4. Remaining reports, data migration, deployment.

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
