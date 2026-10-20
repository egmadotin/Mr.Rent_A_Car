# Mr Rent A Car — rebuild status

**Updated:** October 20, 2026 (dashboard done).

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
| Reservations (list, add, edit, view, 14 actions, email, print) | ✅ (inspection 🟡) |
| Rentals (list, start, edit, end, view, 23 actions, print, email) | ✅ (inspection / damage 🟡) |
| Contracts and invoices (templates, printouts, editor) | ✅ (Standard and Bill Split invoice 🔑) |
| Pricing (rates, seasons, taxes, insurance, misc charges, overrides) | ✅ Standard rate type exact; other rate types approximate |
| Customers (list, add, edit, view and its actions) | ✅ |
| Vehicles (list, add, edit, summary) | ✅ vehicle page actions (🟡 Ownership, Condition, inspections, checklist, images not yet) |
| Users, user groups and permissions | ✅ (group location limit not enforced) |
| Settings | 🟡 about 34 of RentCentric's ~100 setting pages built (section 7) |
| Reports | ⬜ none of RentCentric's ~70 reports built |
| Dashboard | ✅ counts, today's lists, service list, graph, availability (🟡 My Tasks needs the Tasks module) |
| Public website and online booking | ✅ (customer login and fleet filters 🟡) |
| Email | ✅ built, 🔑 needs the client's email (SMTP) account |
| Card payments (Stripe) | ✅ built, 🔑 needs Stripe keys |
| Data migration from RentCentric | 🟡 setup data copied; customers / bookings history not yet |
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
| Add More Drivers inside the form | drivers are added on the reservation page | 🟡 |
| ReservationMain: Start Rental | | ✅ |
| ReservationMain: Cancel, Delete, Move, Duplicate | | ✅ |
| ReservationMain: Payments/Charges | edit and delete payments added Oct 20 | ✅ |
| ReservationMain: Drivers, Bill Split, Pickup/Drop-off | | ✅ |
| Print Invoice, E-Mail Reservation | | ✅ 🔑 SMTP |
| Reservation Inspection | | ⬜ needs vehicle inspections (section 6) |
| Confirmation email on save | | ✅ 🔑 SMTP |

## 4. Rentals

| RentCentric | Ours | Status |
|---|---|---|
| AgreementsSearch | `/admin/rentals` | ✅ |
| CheckOut3: Start a Rental | `/admin/rentals/new` | ✅ |
| CheckOut3: Edit Rental | `/[id]/edit` | ✅ |
| CheckIn2: End Rental | `/[id]/end` | ✅ |
| Rate (i), Other Charges, Add More Information, Upgrade, Fuel Charge | | ✅ |
| Add More Drivers inside the form | drivers are added on the rental page | 🟡 |
| Credit Card (+) saved card | | 🔑 must go through Stripe |
| AgreementMain: Payments/Charges | including editing and deleting payments | ✅ |
| AgreementMain: Adjustments | including edit and delete | ✅ |
| AgreementMain: Commissions | including edit and delete | ✅ |
| AgreementMain: Traffic Tickets, Bill Split, Claims, Drivers | | ✅ |
| AgreementMain: Exchange Vehicle, Pickup/Drop-off, Memo and history | | ✅ |
| AgreementMain: Void, UnVoid, Reopen, Delete | | ✅ |
| Long-term invoices | | ✅ |
| Inspection Comparison, Damage | | ⬜ needs vehicle inspections and damage (section 6) |
| Capture / Refund on card payments | | 🔑 Stripe |
| Payment methods per location (YYC: Cheque, Direct Bill Company) | | ⬜ |

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
| Signature And Initials (Settings) | ⬜ |

## 6. Vehicles

| RentCentric | Ours | Status |
|---|---|---|
| VehiclesSearch | `/admin/vehicles` | ✅ |
| VehicleAdd / VehicleSpecs (73 fields) | `/new`, `/[id]/edit` | ✅ |
| Vehicle page summary | `/admin/vehicles/[id]` | ✅ |
| **Vehicle page actions** | `/admin/vehicles/[id]` | ✅ Oct 20 (fields copied from each RentCentric form) |
| ↳ Insurances | | ✅ |
| ↳ Ownership Information, Vehicle Condition | | ⬜ (fields copied; not built) |
| ↳ Status Change, Vehicle History, Deactivate | | ✅ |
| ↳ Technical Log | | — RentCentric's own page is broken (Parser Error) |
| ↳ Maintenance, Problems, Repairs, Vehicle Services, Carwash | | ✅ |
| ↳ Damage (with Damage Locations / Conditions settings), Accidents | | ✅ (damage photo needs file storage) |
| ↳ Customer Reported Damages, Inspection Comparison, Vehicle Inspection | | ⬜ |
| ↳ Vehicle Claims, Vehicle Checklist | | ⬜ |
| ↳ Rentals, Reservations (this vehicle's) | | ✅ |
| ↳ Notes, Images, Documents | | ⬜ (needs file storage, S3) |
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
| Add Location | ⬜ |
| Upload Logo | ⬜ |

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
| Rental Rates | ⬜ |
| Master Rate Batch Update | ⬜ |
| Rate Values Update | ⬜ |
| Rate Blocking | ⬜ |
| Rate Utilization | ⬜ |
| Rates Calendar | ⬜ |
| Overbooking Control | ⬜ |
| Rates Setup | ⬜ |
| One Way Rates | ⬜ |
| One Way Regions | ⬜ |
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
| Payment Methods | ⬜ |
| Default Payment Method | ⬜ |

### Rental Contracts & Invoices

| Item | Status |
|---|---|
| Rentals & Invoices, Add New | ✅ |
| Signature And Initials | ⬜ |

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
| Vehicle CheckList | ⬜ |
| Vehicle CheckList Items | ⬜ |

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
| Financial / Commission | Referrals | ⬜ (quick-add exists on the forms) |
| Financial / Commission | Commission Structures | ⬜ |
| Website & Email | Mail Server Configuration | ✅ |
| Website & Email | Reservation Email, Quote Email | 🟡 sent with the templates |
| Website & Email | Inspection Email | ⬜ |
| Website & Email | Promotions/Specials | ⬜ |
| Website & Email | Rental Policies | ⬜ |
| Website & Email | Configuration, Style & Format, Add/Edit Webpages | ⬜ (our public site replaces these) |
| Website & Email | Online Reservation (incl. V3, mobile), I-Frame Widget, I-Frame Rotator | ⬜ (our public site replaces these) |
| Website & Email | Merchandise Items, Orders | ⬜ |
| Email Marketing | Send Marketing Email, Email Template | ⬜ |
| Tasks & Messages | | ⬜ |
| Paperless Counter, Counter Agent Pro, Mobile Scanner | | ⬜ (hardware / integrations phase) |

## 8. Reports

None of these are built. Our Reports page is a design placeholder. RentCentric's list:

- **Vehicles:**
  - Vehicles Summary, Vehicles Summary with QR Code.
  - Vehicle Utilization (Today), Fleet Utilization History, Fleet Utilization For Cast, Fleet Utilization Snapshot.
  - Vehicle License Expiration, Vehicle Due In, Vehicle Profit/Loss.
  - Repair Orders, Vehicle Repairs, Vehicle Lease/Loan, Vehicle Maintenance, Maintenance Alert.
  - Snap Shot For Rentals / Vehicle Type, Vehicle Insurance, KM Difference/Missing, Checklist Overview.
- **Customers:** Customer List, Customer By Region, Traffic Tickets, Source Of Referral, Payments & Charges, Customer Notes, Undesired Customers.
- **Rentals & Reservations:**
  - Rental Status, Vehicle Rental Calendar, Fleet Grid, Custom Reports.
  - Corporate A/R By Bills, Customer A/R Report, Reservation A/R by Bills, Corporate A/R Analysis.
  - Reservation Manifest, Reservation Forecast, Reservation Grid, Reservations No Showup/Cancelled, Reservations Calendar.
  - Dynamic Scheduler, Visual Scheduler, Promo Code, Rental Days, Rental Discount.
- **Management:**
  - Daily Business Report, Daily Cash Summary Report, Month to Date Report.
  - Rental Details, Adjustment Details, Invoices.
  - Rental Event Tracking, Reservation Event Tracking, Tasks List.
  - Commissions, Broker Commission, Sales Projection, Work In Process.
  - Revenue By Customer / Vehicle / Location / Rate / Admin / Company / Options, Non-Revenue.

## 9. Dashboard

| RentCentric | Status |
|---|---|
| Status counts (In-fleet … No Show) | ✅ (they link to filtered lists, not RentCentric's detail pages) |
| Rentals Leaving Today / Returning Today lists | ✅ (overdue returns flagged) |
| My Tasks and Add Task | ⬜ (no tasks module yet) |
| Vehicles Requiring Service | ✅ from status and the "maintain every … km" interval; will use the last service entry once Maintenance is built |
| Rental Graph View (7 / 14 days / 1 month) | ✅ |
| Vehicle Availability check | ✅ |

## 10. Public website (mrrentacar.com)

| Item | Status |
|---|---|
| Home, About, Services, Locations, Fleet, Blogs, Contact | ✅ |
| Booking: dates and vehicle → options → details → confirmation, same prices as the live site | ✅ |
| Card at booking (Stripe) | ✅ 🔑 keys |
| Fleet filters (doors, type) | 🟡 seats and bags only |
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
   - Then Inspection, Checklist and Customer Reported Damages, which unlock Reservation Inspection and rental Inspection Comparison.
2. **Dashboard lists:** leaving and returning today, vehicles requiring service; the Tasks module.
3. **Core reports:**
   - Daily Business Report, Daily Cash Summary Report, Month to Date Report.
   - Reservation Manifest, Vehicle Due In, Rental Status.
   - Revenue reports, A/R reports.
4. **Payment Methods per location.**
5. **Data migration:** customers, reservations and rental history.
6. **Deployment.**
7. **Remaining settings pages:** rate tools, one-way rates, claims settings and the rest, as the client needs them.
