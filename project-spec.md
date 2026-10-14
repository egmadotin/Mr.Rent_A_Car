# Mr Rent A Car — RentCentric ERP Audit for Redesign

Oct 11, 2026 · @EGMA

Full walkthrough of the live RentCentric ERP (www8.rentcentric.com/Client6270) used by Mr Rent A Car, covering every module (Dashboard, Quotes, Reservations, Rentals, Vehicles, Customers, Reports, Settings) to ground a from-scratch redesign. No data was created, modified or deleted while scanning — read-only navigation and report generation only.

## Overview & Scope

RentCentric is an ASP.NET car-rental ERP (version 4.3.1.34383) hosted at `www8.rentcentric.com/Client6270`, already logged in under the Mr Rent A Car account. It covers three locations:

| Location | Address |
| --- | --- |
| Surrey BC - Mr Rent A Car | (home/default location for this login) |
| Coquitlam | 323 North Road, V3K 3V8 |
| YYC - Calgary International Airport | Offsite location |

Top navigation: **Dashboard · Quotes · Reservations · Rentals · Vehicles · Customers · Reports (dropdown) · Settings (dropdown)**, plus a location switcher, a "+" quick-add shortcut (Make Reservation / Start Rental / Add Task), search, and a profile menu (My Profile, Video Training, User Manual, Zendesk Support, Log Out).

The fleet spans \~50 vehicle-type classes (Economy/Compact through Luxury SUV, Tesla Model 3/X/Y, vans, etc.) and real operating history back to 2018, including a corporate account (Open Road Group / Mercedes-Benz Surrey).

This document is organized by module, in the order a staff member encounters them, ending with a prioritized list of redesign opportunities and open questions to confirm with the client before scoping the rebuild.

## Data Model Summary

Reverse-engineered from every "Add/New" form in the app (none were submitted). This is the core schema a rebuild should model.

| Entity | Key fields observed | Relationships |
| --- | --- | --- |
| **Location** | Name, address, hours of operation, offsite flag | Vehicles, Rates, Users and Quotes/Reservations/Rentals all scope to a pickup/return Location |
| **Company** (corporate/insurance/travel-agency account) | Name, Type (Insurance/Corporate/Dealership/Body shop) | Optional on Quote, Reservation, Rental; drives Corporate A/R reports |
| **Customer / Driver** | Name, Driver's Lic.#, Lic.Exp, Lic.State, DOB, address, phone, email, insurance (policy #, company, expiration, phone, fax) | 1 Customer -> many linked Drivers (Additional Drivers); 1 Customer -> many Reservations/Rentals/Quotes; Credit Cards, Club Member flag, Scanned IDs attach per customer |
| **VehicleType** | \~50 classes (Economy, Compact SUV ... Tesla Model 3/X/Y, Luxury SUV, vans) | Master taxonomy driving Rate lookup and fleet search/availability |
| **Vehicle** | 60+ fields: identity (Make/Model/Year/VIN/License#), ops (Location, Status, Fuel/Tank, Category, Body), compliance (Insurance, Inspection, License Expiration, LDW rate), mechanical specs (Engine, GVWR, MPG), pricing (Subscription/Mileage PlanIDs, Retail Price range) | Belongs to a Location and VehicleType; has Damage/Accidents/Maintenance/Repairs/Insurance/Claims sub-records and Images/Documents |
| **RatePlan** | Rate per VehicleType, tied to Location and date range | Selected on Quote/Reservation/Rental after VehicleType |
| **Quote** | Pickup/Return Date & Location, VehicleType, Rate, Discount, Referral, OtherCharges\[\] | Converts to Reservation ("Make New Reservation") or directly to Rental ("Start Rental") |
| **Reservation** | Everything on Quote plus full Customer/Driver capture, specific Vehicle assignment, Delivery Address, Airline/Flight/Hotel, PO#/RO#, Payment | Links to Customer, Company, Vehicle, OtherCharges\[\], Payment(s); becomes a Rental via "Start Rental" |
| **Rental / Agreement** | Everything on Reservation plus Check-Out/Check-In Channel, Opened By/Closed By, Fuel, Traffic Tickets, Admin Charge, Split Bill | The busiest entity: \~24 linked actions (End/Void/Delete/ReOpen Rental, Vehicle Exchange, Adjustments, Commissions, Claims, Bill Split, Inspection Comparison) |
| **Charge line item** (recurring pattern) | Charge name, Unit, Rate, Total | Same shape reused identically on Quote, Reservation and Rental screens — Daily/Hourly rate, Km Allowed, Discount, add-ons (Damage Waiver, Additional Driver, Energy Recovery Fee, Licence Fee, etc.), taxes (GST/PST), Total |
| **Payment** | Method (EMT e-transfer, Visa/card with masked number & auth code), Amount, Transaction Type | Many payments per Reservation/Rental; rolls up to Total Payments / Balance |
| **Referral**, **Equipment**, **User/UserGroup** | Supporting lookups | Referral attaches to Quote/Reservation; Equipment (GPS, infant seats) is separately inventoried and rentable; Users belong to permission Groups |

**Booking lifecycle:** Quote -> Reservation -> Rental is a manual, linear progression driven by action links on each screen (not a guided wizard), with the same Customer, Vehicle, Charges and Payment structures carried forward at each stage.

## Core Booking Flow: Quotes, Reservations, Rentals

### Quotes

Search/list screen with a basic text search plus a collapsible Advanced Search (Quote#, date range, Location, name, phone). Results grid: Quote#, Date, Name, Phone, Location, an inline **Delete (x)** icon with no confirmation. Quote detail is a two-column layout: left-side summary + action links (Email/SMS/Print Quote, Make New Reservation, Start Rental, Memo); right-side itemized Charge table (Daily rate, Km Allowed, add-ons, taxes, Total). The **Add Quote** form has no Customer field — only trip/vehicle/rate details — Discount (preset reason dropdown + free %), Referral, and an "Add/Edit Other Charges" extensibility point.

### Reservations

Same search/list pattern. The **New Reservation ("Reserve")** screen is the richest single screen in the app: two tabs (Customer, Reservation) plus a persistent Payment panel, combining customer capture + booking + payment in one \~45-field flow. Notable existing safeguards: a "Check Matching" duplicate-customer check next to Last Name, and a Memo "always display as popup" flag. Reservation detail adds a 13-link action grid (Start Rental, Cancel/Delete Reservation, Payments/Charges, Additional Drivers, Bill Split, Move/Duplicate Reservation, etc.) where **Cancel** and **Delete** sit visually identical to safe actions like Print and Email.

### Rentals ("Rent" module)

The busiest detail screen in the entire app: **\~24 action links in two unstyled columns**, mixing destructive actions (Void/Delete/UnVoid/ReOpen Rental) with routine ones (Print, Email) at identical visual weight. Real operational edge cases are visible live: traffic ticket charges, under-age driver fees, multiple payment types (e-transfer + credit card) itemized together, and a memo history showing genuine staff notes (e.g. "emiled for paying ticket on feb14"). Data goes back to 2018 with real corporate-account history (Open Road Group / Mercedes-Benz Surrey).

**Shared pattern across all three:** identical search/advanced-search/paginated-grid list screens, an identical Charge-table shape on every detail screen, and the same manual "click through to the next stage" progression (Quote -> Make New Reservation -> Start Rental) rather than a guided checkout flow.

## Fleet Module: Vehicles

The list screen shows Make(ID), License Number, Type, Current/Owning Location, Status, Future Res, and quick **Reserve**/**Rent** action links per row. The fleet spans dozens of units across Surrey BC and YYC Calgary (Toyota, Honda, Nissan, Mitsubishi, Kia, Dodge, BMW, Mercedes, Tesla, Audi, Range Rover, Jeep, vans).

Vehicle detail has a spec summary (Year, Odometer, VIN, Registration#, Status) plus **\~16 action links** (Ownership Information, Accidents, Vehicle Condition, History, Maintenance, Repairs, Carwash, Damage, Insurances, Status Change, Deactivate, Problems, Vehicle Services, Customer Reported Damages, Inspection, Checklist) and a Notes/Images/Documents panel.

**The Add New Vehicle form is the largest data model in the entire application — 60+ fields in one continuous, unsectioned form**, spanning five natural groups that are currently not visually separated:

| Group | Example fields |
| --- | --- |
| Identity/Spec | Assigned ID, Make\*, Model\*, Year, Color\*, Doors, Cylinders, Transmission, Type\* |
| Operations | Rental/Owning Location, Category, Body, Fuel Type, Tank Size\*, Fuel Level slider |
| Maintenance/Insurance/Legal | Maintenance Begin Odometer/Date/Every Km\*, Insurance Amount\*, Inspection Date/Amount\*, License Number/State/Expiration\*, LDW Monthly Rate\*, VIN |
| Mechanical Specs | Power Train, Fuel Grade, Oil Type, Max Payload, Engine Brand/Type, GVWR, City/Highway MPG |
| Appearance & Pricing | Interior/Exterior Color (+ RGB codes), Stereo, Subscription/Mileage PlanIDs, Marketing Description, Retail Price Low/High |

Several fields (RGB color codes, a duplicated GVWR field, Stereo) look like legacy carry-overs worth a "do we still need this" pass with the client rather than reproducing as-is.

## Customers

List columns: Full Name, Phone, Location, License Number, DOB, Email, Zip, Date Entered, Active. Pagination here is just ">/>>" arrows — a different, simpler pattern than the Page-x-of-y + size selector used on Quotes/Reservations/Rentals/Vehicles, an inconsistency worth fixing.

Customer detail is the **cleanest, simplest screen in the app** relative to Rentals/Vehicles: a summary block plus a tidy action list (Customer Information, Credit Cards, Club Member, Scanned IDs, Deactivate, Start/End Rental, Rentals, Reservations, History). It's a good pattern to extend to the rest of the app rather than redesign from scratch.

**Data quality issue observed live:** duplicate customer records for the same person — "CAO HAN" / "HAN CAO" / "PETER LEE" all share phone 7782238896 and the same Burnaby address, entered minutes apart back in 2018. The "Check Matching" duplicate-detection already built into the Reservation form should be applied consistently (including at Customer creation) in the rebuild.

Also noted: the "Registration Channel" field shows a raw staff email (e.g. `louis@mrrentacar.com`) rather than a channel name like Walk-in/Website/Phone — looks like a data-mapping bug to fix rather than a pattern to preserve.

## Reports & Settings

Both use the same left-nav accordion pattern: a category list on the left, expandable panels of plain links on the right, no search across items, no "configured vs. default" status.

### Reports (\~57 reports across 4 categories)

- **Vehicles (15):** Vehicles Summary, Utilization (Today/History/Chart), License Expiration, Due In, Profit/Loss, Repair Orders, Repairs, Lease/Loan, Maintenance + Alert, Snap Shot by Vehicle Type, Insurance, KM Difference/Missing
- **Customers (8):** Customer List, By Region, Traffic Tickets, Source of Referral, Revenue by Referrals, Payments & Charges, Notes, **Undesired Customers** (a do-not-rent blacklist)
- **Rentals & Reservations (15):** Rental Status, Vehicle Rental Calendar, 3x Corporate/Customer/Reservation A/R reports, Fleet Grid, Custom Reports, Reservation Manifest/Forecast/Grid/Calendar, No Showup/Cancelled, **Dynamic Scheduler**, **Visual Scheduler**
- **Management (19):** Daily Business/Cash Summary, Month to Date, Event Tracking (Rental & Reservation), Tasks, Commissions, Sales Projection, Work In Process, Revenue by Customer/Vehicle/Location/Rate/Admin/Company/Options, Non-Revenue

The heavy A/R and corporate-billing reports confirm B2B/corporate billing is a real workflow, not just retail counter rentals. **Visual Scheduler** (opened and generated live) is a Gantt-style grid — vehicle rows x date columns, color-coded bars for Unassigned Reservation / Reservation / Agreement / One-way rental. It's the closest thing to a fleet-availability calendar in the app; visually dated but the underlying data shape (vehicle x date x status) is exactly what a modern booking-calendar redesign should build on.

### Settings (17 categories, 80+ individual pages)

Location Information · Users · Rates (8 items incl. One Way Rates/Regions, Pay Now Discounts) · Company · **Import Data and Other Tools** (Customer/Company/Rate/Reservation/Referral/Vehicle Import, Copy Location Setup, Renew Rental Agreements — confirms CSV-style import tooling already exists for a migration) · Payment Settings · Rental Contracts & Invoices (customizable templates) · Vehicle Setup (13 items incl. SIPP Codes — the international rental-industry vehicle classification standard, suggesting GDS/OTA integration readiness) · Equipment Setup · Self Service & Car Share SetUp (keyless/self-checkout capability exists but is unused) · Claims Management · Financial/Commission Settings · **Website & Email Setup** · SMS Notification · Point of Sale · Email Marketing · Tasks Messages.

**Important finding:** Website & Email Setup includes **Website Design V3** ("fully customize the look and feel of the website"), **Add/Edit Webpages**, and **Widget/Rotator Setup** (embeds a RentCentric reservation widget on an external homepage). RentCentric ships its own built-in public booking-website CMS — this may be what currently generates the customer-facing booking site, separate from the back-office screens audited above. **This needs confirming with the client:** does the rebuild replace this public booking website too, or only the staff-facing ERP?

## Redesign Priorities & Open Questions

### Highest-impact redesign targets, ranked

1. **Rental detail screen** — \~24 undifferentiated action links mixing destructive (Void/Delete/UnVoid) and routine (Print/Email) actions with identical styling. Split into tabs/sections (Overview, Charges, Payments, Documents, Activity Log).
2. **Add New Vehicle form** — 60+ fields in one flat, unsectioned form. Group into Identity / Operations / Compliance / Mechanical / Pricing, likely as a multi-step or tabbed form, after confirming which fields are actually still used.
3. **Booking calendar / availability view** — the existing Visual Scheduler's vehicle x date x status data shape is sound but the UI is dated (tiny grid, horizontal scroll, no drag/resize). A modern channel-manager-style calendar would be a visible, high-value upgrade.
4. **Destructive-action safety** — inline Delete icons in list grids (Quotes) and Cancel/Delete links with no visual distinction from safe actions (Reservations, Rentals) appear throughout; add confirmation and visual hierarchy consistently.
5. **New Reservation ("Reserve") screen** — \~45 fields across 2 tabs with no sub-sectioning. Preserve the useful parts (duplicate-customer "Check Matching", collapsible Other Charges) inside a cleaner progressive-disclosure layout.
6. **Consistency pass** — pagination style differs between Customers (arrows) and every other module (page x of y + size); Dashboard's "graph" is a list of plain progress bars rather than a real chart; Reports/Settings have \~50 and \~80 items respectively with no search.
7. **Data cleanup** — duplicate customer records (seen live) and a likely-mismapped "Registration Channel" field (showing staff emails) suggest a data-quality pass should run alongside the rebuild, not after it.

### Open questions for the client

- **Public booking website:** Settings > Website & Email Setup includes a full website CMS (Website Design V3, Add/Edit Webpages, Widget/Rotator Setup). Is the customer-facing booking site generated by this, and is it in scope for the rebuild, or only the staff-facing ERP screens?
- **Self Service & Car Share:** the keyless/self-checkout capability exists in Settings but shows no live usage. Keep, drop, or build out in the new version?
- **Corporate/B2B billing:** heavy A/R reporting (Corporate A/R by Bills/Analysis, Customer/Reservation A/R) confirms real corporate-account billing beyond retail counter rentals — confirm this workflow's priority for the rebuild.
- **Legacy vehicle fields:** RGB color codes, duplicate GVWR field, Stereo, and similar fields on the vehicle form — still needed, or safe to drop?
- **Migration:** Settings > Import Data and Other Tools already has CSV-style import for Customers, Companies, Rates, Reservations, Referrals and Vehicles — useful as a reference for what the new system's import/migration tooling needs to replicate at minimum.

## Public Website Audit: mrrentacar.com

The client confirmed the public marketing/booking site, **https://www.mrrentacar.com/**, is also in scope for a full redesign alongside the ERP. It is a separate system from RentCentric's own "Website Design V3" CMS (found in ERP Settings, see section 6) — the two were not confirmed to be the same engine, but the site's structure (a blog with dated posts/categories/comments, a standard page-builder layout, custom 404 handling) points to an independent CMS (likely WordPress-style) with an **embedded RentCentric-style reservation widget**, not a site generated inside RentCentric itself. A direct request to `/wp-admin/` redirected back to a site page rather than a WordPress login screen, so this is not fully confirmed either way — worth settling with the client directly before the rebuild starts.

### Site structure

| Page | URL | Notes |
| --- | --- | --- |
| Home | `/` | Hero booking widget (pick-up/return location, date, time, promo code), a "Choose Location" selector, vehicle-type "Reserve Now" cards (\~29 vehicle types/classes), marketing blurbs, locations teaser, blog teaser (3 latest posts) |
| Fleet | `/fleet/` | Full catalogue of \~29 vehicle types as cards (seats/luggage/doors shown per card) with filter sidebar (Vehicle Type, Luggages, Doors, Seats) and a "Reserve Now" CTA per card — this is the fleet list customers browse, distinct from the ERP's internal Vehicles module |
| Our Services | `/our-services/` | Generic marketing page: 6 service bullets (Diverse Vehicle Selection, Customer Service, Affordable Rates, Seamless Online Booking, Convenient Locations, Flexible Rental Options) |
| Our Locations | `/our-locations/` | 6 locations with full address, phone, fax, email, and office hours: Vancouver, Burnaby, Richmond, Surrey, YVR Airport Offsite, Calgary |
| About Us | `/about-mr-rent-a-car/` (nav link does **not** match the URL slug "about-us") | Company history/founding (1996) copy, a 9-stop chronological timeline (1996–2024) with expandable entries, an FAQ accordion (3 questions shown: locations, age requirements, pickup documents) |
| Contact Us | `/contact-us/` | Contact form (Name, Email, Phone, Subject, Message, privacy-terms checkbox) plus a repeated booking widget and a locations list |
| Blogs | `/blogs/` | Standard blog index: tagged/categorized posts (e.g. "Trips and Tour", "Autonomous Calgary", "Calgary Stampede", "Car Rental in Burnaby/Richmond", "Vancouver", "YVR"), author byline, publish date, comment count — content-marketing/SEO oriented |
| Login | modal (`#`), not a page | Clicking "Login" in the top bar opens an in-page modal with **Email** and **Password** fields and a "Login" button — a customer-facing account login, separate from staff ERP login. Not tested (would require submitting credentials); destination/backend unconfirmed |
| "Car for Sale" (nav item) | links out to **https://www.mrautosaleslease.com/** | Not the same site — appears to be a related/sister business (vehicle sales & leasing) on its own domain. Not reachable for this audit (blocked by browser policy); flagged as an open question on whether it's in scope for the rebuild |

### Observations relevant to the rebuild

- The homepage, Fleet page, and Contact page all embed the **same booking widget** (location pickers, date/time pickers, promo code) — this should become one reusable component, not three separate instances, in the rebuild.
- The vehicle class list on the public site (\~29 named classes like "Mystery Car", "Model 3", "iX xDrive", "BMW X1") should be reconciled against the ERP's internal Vehicle Type / Vehicle records (section 4) — these public-facing class names may not map 1:1 to the ERP's VehicleType entity today.
- Two broken/inconsistent nav links were found during the scan: the "About Us" nav item resolves to `/about-mr-rent-a-car/`, not the more conventional `/about-us/`; a worthwhile cleanup item for the rebuild's URL structure.
- The customer Login modal is a separate identity surface from both the staff ERP login and any future Plaid-based verification (see next section) — the rebuild should decide whether customer self-service accounts, staff login, and identity verification share one auth system or stay separate.
- No online-checkout/payment step was observed on the public site itself during this scan — the booking widget appears to submit into the reservation flow rather than process payment inline; worth confirming with the client whether deposits/payments are ever taken directly on the public site today.

## Required Integrations

*Client note: these three integrations are confirmed as future-phase work, not part of the initial rebuild scope. Keeping the research below on file so it's ready when that phase starts.*

Three third-party integrations were named for the rebuild. None are connected in RentCentric today (no matching settings/integration pages were seen during the ERP scan in sections 1–6); each would be a net-new build.

### Moovetrax — GPS fleet tracking & remote vehicle control

**What it is:** A hardware GPS tracker + companion platform marketed directly at car rental companies and peer-to-peer fleets (e.g. Turo/GoMore hosts). The pitch is owner control without a renter-side app.

**Key features:**

- Real-time location, updating as often as every 30 seconds; trip/route replay with speed and signal strength
- Unlimited geofences with boundary-crossing alerts, speed-limit alerts, toll reporting, hood-open detection
- Remote immobilization (kill switch), remote lock/unlock
- Bluetooth/keyless proximity access, smartphone passive entry, a Wear OS smartwatch app
- Temporary "guest access" links scoped to a rental's start/end time — no app required on the renter's phone
- Multiple staff sub-user accounts; Tesla and other connected-car brands can be added without extra hardware
- A published **API** exists (linked from their site) but its scope wasn't detailed on the marketing pages — needs a developer-account/API-docs review before scoping effort

**Integration shape for the rebuild:** Likely a server-to-server API integration — pull live vehicle location/status into the Vehicle and Rental modules (e.g. show "where is this car right now" on a Rental detail screen, auto-flag overdue/out-of-geofence vehicles), and optionally trigger the guest-access link automatically when a Rental is checked out. Remote immobilization is a higher-risk action (ties to the app's prohibited-action rules around irreversible/destructive actions) and should be a deliberate, confirmed action in the UI, not automatic.

### Plustek — document / ID scanning hardware

**What it is:** A scanner manufacturer (document, ID/"identity capture", book, film, and network scanner lines), sold with capture software (PlustekCapture, DocAction) and **developer SDKs for document automation workflows**. Their marketing pages don't call out car rental or front-counter ID check-in specifically, so the exact hardware model (e.g. a compact driver's-license/passport scanner vs. a general flatbed) needs to be confirmed with the client — they likely already own specific hardware.

**Integration shape for the rebuild:** A counter-side SDK integration: staff scan a customer's driver's license/passport at check-in, the SDK returns captured image + (depending on model) parsed MRZ/barcode data, and the rebuild auto-fills the Customer record's ID fields and attaches the scanned image to the Customer/Rental file — replacing manual typing of license numbers seen in today's Add Customer form (section 5). This is a local/desktop SDK (talks to USB-connected hardware), not a cloud API, so it constrains the rebuild to a native or browser-with-local-agent approach at the counter rather than a pure web app, unless Plustek's SDK exposes a local web-service bridge.

### Plaid Identity Verification — KYC / renter identity verification

**What it is:** A hosted identity-verification product: checks a person's stated identity against regulated data sources, authenticates their ID document, and confirms liveness/selfie-to-ID face match, backed by a fraud-risk engine (bot/fraud-ring behavior, email/phone risk, device/network risk, synthetic-identity detection).

**Flow:** Identity data check → guided ID document capture → document authentication → liveness + face match → (optional) autofill remaining details from phone + DOB → pass/fail + risk signals returned to the business. Verification typically completes in as little as \~10 seconds; Plaid cites 90%+ pass rates and support for 16,000+ ID types across 200+ countries.

**Integration options** (increasing dev effort):

1. **No-code:** generate a one-off verification link from Plaid's dashboard, no integration work
2. **Hybrid:** verify via API, use Plaid's hosted UI for fallback/exception handling
3. **Fully embedded:** Plaid's UI embedded end-to-end inside the rebuilt app

Also includes a no-code flow editor, adjustable risk rules, audit session records, and a compliance dashboard for manually overriding failed verifications.

**Integration shape for the rebuild:** This is the natural fit for **online/remote reservations** — verifying a renter's identity before they ever reach a counter (useful for the self-service / car-share style bookings referenced in the ERP's "Self Service" fields, section 7). It overlaps in purpose with the Plustek counter scan, so the rebuild should decide a clear split: Plaid for remote/online identity checks (and likely for age/license verification ahead of pickup), Plustek for the physical in-person document scan at the counter. Both ultimately feed the same Customer record's identity/license fields, so that data model (section 2) should treat "identity verified: yes/no, method, timestamp" as a first-class field regardless of which path produced it.

### Open questions added to the integration scope

- Does Moovetrax hardware already exist in some/all fleet vehicles today, or would this be a new fleet-wide hardware rollout?
- Which exact Plustek model(s) does the client currently use or intend to buy (affects whether MRZ/barcode parsing is available)?
- Should Plaid verification be required for every online booking, or only for certain vehicle classes / new customers / self-service bookings?
- Who is the data controller for the identity documents captured by either Plustek or Plaid — does the client need updated privacy-policy language and a defined retention period?

## Recommended Tech Stack

Decided stack for the rebuild, chosen to replace RentCentric's ASP.NET ERP and the current WordPress-style public site with one modern codebase — and to leave room for a customer-facing mobile app without a future rewrite.

### Monorepo (Turborepo)

| Package | Contents |
| --- | --- |
| `apps/web` | Next.js 15 + TypeScript — staff ERP, customer portal, public booking site, and blog, all in one codebase |
| `apps/mobile` | Expo / React Native — added when the customer app is built; consumes the same typed API as the web app, no separate rewrite |
| `packages/api` | tRPC, split into a **customer** router (booking search, quote/reservation creation, account, payments — the stable, versioned surface the future app depends on) and a **staff** router (internal ERP: vehicles, reports, settings) |
| `packages/db` | Prisma schema, mapped directly from the reverse-engineered data model in section 2 of this doc |

**Why not Server Actions for customer flows:** Server Actions only work from inside the Next.js app itself (tied to the React Server Components protocol) — a future native app can't call them. Anything the mobile app will eventually need (booking, account, payments) is built as a real tRPC/API endpoint from day one, even though only the website calls it today.

### Data layer

- **PostgreSQL** — chosen over a document DB because the data model is relentlessly relational (Quote → Reservation → Rental → Charges/Payments, Vehicles joined to VehicleType and Location, and \~50 reports that are mostly multi-table joins and sums). Real foreign keys and transactions matter for the booking state machine, including preventing double-booking the same vehicle (handled via a DB transaction + unique constraint/row lock, not application code).
- **AWS RDS for PostgreSQL, `ca-central-1` (Montreal)** — locked in now that hosting is AWS. Resolves the earlier data-residency open question: same AWS account/VPC as the app, lower latency, PIPEDA-friendly by default for a Canadian client.
- **Prisma** as the ORM, schema generated from the audited data model.
- **S3** for vehicle photos, damage photos, and — once the deferred integrations phase starts — ID/document scans from Plustek and Plaid.

### Auth

- **Better-Auth** — self-hosted, free, no per-user cost as the customer base grows. Has a first-class Expo/React Native plugin, so the same auth system covers web cookie sessions today and mobile token sessions when the app ships, with no migration. Chosen over NextAuth/Auth.js specifically because NextAuth is built around web cookie sessions and is awkward to extend to a native app later.

### UI

- **Tailwind CSS + shadcn/ui** — fast to build the data-heavy screens this ERP needs (tables, filters, multi-step forms) without fighting a component library.

### Background jobs

- **Inngest** (or Trigger.dev) for nightly reports, booking reminders, overdue-rental flags, and — later — Moovetrax/Plaid webhook processing. Keeps heavy work off the request/response path, which matters most on serverless hosting where function calls have a timeout.

### Scheduling / calendar

- **FullCalendar** or **DayPilot** (resource-timeline view) to rebuild the Visual Scheduler report (section 6) as an interactive Gantt-style fleet calendar instead of a static report.

### Hosting (AWS)

- **ECS on Fargate** for `apps/web` — containerized, auto-scaling, and crucially a persistent Node process (not Lambda-style serverless), so scheduled jobs and WebSocket connections work natively if ever needed directly — this is what resolves the "Next.js can't do cron/websockets/long-running work" concern: that limitation is specific to serverless platforms like Vercel, not to Next.js itself.
- **S3** (same AWS account/region) for vehicle photos, damage photos, and later KYC document scans from the deferred integrations phase.
- **ElastiCache (Redis)** if/when BullMQ-style queuing is wanted alongside or instead of Inngest — natural fit already being on AWS.

### Deferred to the future-integrations phase

Moovetrax (GPS/fleet tracking), Plustek (ID/document scanning), and Plaid Identity Verification (see the Required Integrations section above) all wire in through `packages/api` and Inngest once that phase starts — no architecture changes needed, the stack already has a slot for them.

### Still open with the client

- **Payment processor** — what they use today for deposits/damage holds; Stripe is the default if nothing is already in place.
