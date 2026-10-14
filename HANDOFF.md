# Handoff — Mr Rent A Car rebuild

Last updated: 2026-10-12. Read this first, then `project-spec.md` (the full audit and stack decisions) and `CLIENT-QUESTIONS.md` (open questions for the client).

## The task (from the user's brief)

Rebuild the RentCentric car-rental ERP (staff) and mrrentacar.com (public booking site) as one Turborepo:

- Next.js 15 + tRPC + Prisma/Postgres + Better-Auth + Tailwind/shadcn.
- The public site and the ERP are **structurally separate**: `app/(public)` and `app/(erp)` never import each other (enforced by ESLint). Anything both need goes in `packages/*`.
- ERP layout: **left sidebar**, collapsible.
- **Theme tokens only**: no raw colours in components.
- **Build order**: Prisma + auth → ERP shell → Rental detail → Add Vehicle → booking calendar → Reservation → Quotes/Customers → public site + booking widget.
- After each module, **cross-check against the live legacy ERP**: https://www8.rentcentric.com/Client6270/home3.aspx. The user is logged in there in Chrome. It is **read-only: never submit or save anything on it.**
- **Don't invent fields or workflows.** Ask the user before dropping any field.

User decisions already made (don't re-ask):

1. Keep **every** `/// CONFIRM` field exactly as on the live forms. Don't drop anything; it's tracked in CLIENT-QUESTIONS.md.
2. **Locations match RentCentric Settings > Locations exactly** (user, Oct 12: "the locations must match all locations"; supersedes the earlier "Surrey/Coquitlam/YYC only" decision):
   - Active: Richmond, Burnaby, Vancouver Admin, YVR, YYC, Surrey. **Coquitlam is inactive** in RentCentric.
   - On the public site (`Location.displayOnline` = RentCentric "Web Customer"): Richmond, Burnaby, Vancouver Admin, YVR, YYC. Surrey is active for staff but not on the website. This is exactly the location list on mrrentacar.com/fleet.
   - Re-import: `pnpm --filter @mrac/db exec tsx prisma/import-legacy-locations.ts` (reads `legacy/locations.json`).
3. Integrations (Plaid, Plustek, Moovetrax, Yoti) are **not** wired up. Their fields exist and are entered by hand (ID verified + method + timestamp, licence #, GPS lat/lng/tracker).

## How to run (Next.js in the Docker `dev` container; Postgres in `db`)

D: has only ~1.2 GB free, so packages and build output must stay in Docker volumes. Running natively from D: with packages on another drive does NOT work (webpack resolves paths across drives wrongly: "Can't resolve './C:/…/next/dist/client/app-next-dev.js'").

```
docker compose up -d                       # Postgres on localhost:5442 + dev container
docker compose exec dev pnpm install        # only when dependencies change
docker compose exec dev pnpm db:migrate     # prisma migrate deploy
docker compose exec -d dev sh -c "cd apps/web && pnpm dev > /tmp/next.log 2>&1"
docker compose exec dev sh -c "tail -f /tmp/next.log"   # follow the log (Ctrl+C stops following only)
# http://localhost:3001 (public), http://localhost:3001/admin (ERP). Port 3001: the user runs another project on 3000.
```

- Restart: `docker compose restart dev`, then the `pnpm dev` line again.
- **Dev staff login**: `staff@mrac.test`. The password is in `packages/db/prisma/seed.ts` (it's a test value).
- Don't `pnpm install` on the host.
- **Typecheck**: `docker compose exec -T dev sh -c "cd apps/web && npx --no-install tsc --noEmit"` (ignore TS6053 / `.next/types` noise).
- **Lint**: `docker compose exec -T dev sh -c "cd apps/web && npx eslint app"`.
- **Dev server**: webpack (`next dev -p 3001`; Turbopack doesn't see file changes on the Windows bind mount). First compile of each page takes 30–90 s on this machine. **After any Prisma schema change** restart the container and `pnpm dev`.
- **Schema changes**: `docker compose exec -T dev sh -c "cd packages/db && npx prisma migrate dev --name X"`. CHECK and EXCLUDE constraints that Prisma can't express live in `packages/db/prisma/sql/constraints.sql`. Append any new ones to the migration's SQL by hand.

## Layout

```
packages/db     Prisma schema, migrations, seed.ts (real reference data from the live ERP/site + fake TEST bookings)
packages/auth   Better-Auth (email+password, admin plugin), isStaff()
packages/api    tRPC: routers/customer.ts (public, stable for future Expo app) + routers/staff/*
                lib/pricing.ts (charge-line engine), lib/totals.ts, lib/audit.ts, lib/errors.ts (double-booking guard),
                lib/bill-split.ts, transformer.ts (Decimal -> string on the wire; use Wire<T> type on client)
packages/ui     tokens (styles/globals.css, data-brand="erp"|"public" + .dark), ThemeProvider, shadcn-style components, lib/format.ts
apps/web/app/(erp)     ERP: layout, sidebar shell, _components (form helpers, ConfirmAction, Pagination, booking-dialogs), _lib/session.ts
apps/web/app/(public)  public site: layout/header/footer, ONE BookingWidget (booking-widget.tsx), pages
apps/web/middleware.ts redirects /admin/* to login without session cookie; (app)/layout re-checks staff role server-side
```

Key design points:

- **No double-booking**: the `VehicleBlock` table has a Postgres EXCLUDE constraint on vehicle + time range. Every assignment goes through `withBookingGuard`.
- **Money**: Decimal in the DB; it reaches the client as strings. Totals are computed on the server.
- **Deletes are soft** (`deletedAt`). Destructive actions all use `ConfirmAction`: Delete requires typing the record number, Void/Cancel require a reason.
- **History**: field-level changes go to `AuditLog` (the legacy "Agreements Log").
- **Date-only columns** are stored as UTC midnight and formatted in UTC. Datetimes are rendered client-side, or with `<LocalDateTime>` in Server Components, so they show in the viewer's time zone.

## Done (all built and clicked through in the browser against seed data)

| Module | Route | Notes |
| --- | --- | --- |
| Schema + auth | — | 5 migrations. Every legacy form field captured: Vehicle, Quote, Reservation, CheckOut, Customer, Company, Rate, Misc charges, Taxes, Bill Split, Traffic Ticket, Claim, Adjustment, Commission, Club Member, Credit Card |
| ERP shell | `/admin` | Sidebar (collapsible, persisted), location switcher, "New" menu, light/dark theme, dashboard counters |
| Rental detail | `/admin/rentals/[id]` | Legacy's ~24 flat links replaced by state-aware header actions plus 7 tabs; danger actions in a separate menu, confirmed. Tested: payment, end, reopen, activity log. Print page at `/admin/print/rentals/[id]` |
| Add Vehicle | `/admin/vehicles/new` | 73 fields in 6 sections with jump-nav; legacy required rules; legacy fields in a collapsible "pending review" block; manual GPS. List + read-only detail |
| Fleet calendar | `/admin/calendar` | Visual Scheduler replacement: legend, 7/14/30-day views, filters by type and location, drag or popover to assign unassigned reservations (same type only) |
| Reservations | `/admin/reservations[/new, /[id], /[id]/edit]` | Single form with progressive disclosure, live charge preview, Check Matching duplicate panel, availability-filtered vehicle list, optional payment. Detail: Start Rental (tested), confirm, cancel, no-show, reinstate, duplicate, move to customer, delete, bill split, pickup/drop-off, drivers, memo |
| Quotes | `/admin/quotes...` | List (delete confirmed), form with live pricing, detail; Make reservation / Start rental prefill from the quote (tested) |
| Customers | `/admin/customers...` | List (standard pagination), sectioned form with live duplicate check plus a confirm before creating a duplicate, detail tabs (rentals, reservations, cards as last 4 only, club member, scanned IDs, notes, history), manual ID-verified (tested), deactivate |
| Walk-in rental | `/admin/rentals/new` | Own Start a Rental form (CheckOut3.aspx) → `rental.startWalkIn` — see Rentals section below |
| Public site | `/`, `/fleet`, `/our-locations`, `/contact-us`, about/services/blogs stubs | Real location hours and contacts and class specs from mrrentacar.com. One `BookingWidget` (hero/panel/compact). Redirect `/about-mr-rent-a-car` → `/about-us` |
| Public booking | `/book` → `/book/details` → `/book/confirmed` | Priced results (tested), details form (renders). `customer.requestReservation` creates a TENTATIVE reservation with channel "Website" and no payment |

## Left off exactly here (Oct 14)

Current directive from the user: make **quotes, reservations and rentals** match RentCentric exactly (every field on create / edit / view), then the **public booking** flow exactly as mrrentacar.com, then **invoice / contract / agreement templates** identical to the old ones and editable, with permission-based edit/delete. Don't invent fields. Screenshot-compare every step. Prices: the client sends a price master sheet (they change every 2–3 days), so don't spend more time scraping rates.

Status:
- Quotes: DONE (list, Add Quote, view, Email/SMS dialogs).
- Reservations: DONE (list, Reserve form, ReservationMain view).
- Rentals: list DONE, **Start a Rental DONE** (commit `d99c4a3`). See "Rentals" at the bottom.

Next steps, in order:
1. ~~Rental view~~ DONE. ~~Rental edit~~ DONE (see Rentals section).
2. ~~End Rental~~ DONE (needs a live-screen check, see Rentals section).
4. **Public booking** step by step against mrrentacar.com, including the "Rental Options" step (`/rental-options/?vehicle-type=…&rate-id=…`) that we still skip; add `/book/options` using MiscCharge, and extend `customer.requestReservation`.
5. **Templates**: AgreementsPrintSelect.aspx printouts (Bill Split Invoice, Bill to Invoice Test, Break Down, Closing Test(s), Customer Invoice, Open Contract, Open Contract-march 2017, Standard), plus Print Quote and Reservation Confirmation. Make them editable in Settings. Wire up `?print=` from Start a Rental and the disabled Print/Email links.
6. Permissions: admins / permitted users can edit and delete anything.

Test data in the local DB only: rental #3 + customer "Walkin Tester" (from the Start a Rental test).

## Still to do

1. **Finish the public booking test** (above). Then cross-check the public flow against mrrentacar.com once more:
   - **Fleet filters**: the live site filters by type, luggage, doors and seats; ours has seats and bags only. Consider adding doors and type.
   - **Customer Login modal**: on the live site, but no backend is known. Ask the client; not built.
2. **Spec redesign item 6**: search across Reports and Settings; a real chart on the dashboard. **Reports (~57) and Settings (17 categories) are not built at all.** The sidebar links 404.
3. **Vehicle detail module**: the legacy ~16 actions (Accidents, Damage, Maintenance, Repairs, Carwash, Insurances, Status Change, Deactivate, Problems, Services, Customer Reported Damages, Inspection, Checklist, Images/Documents). Capture their fields read-only from the live ERP first (`VehicleMain.aspx`).
4. **Not built yet**:
   - Company management screens (the model exists).
   - Rate editor (the model exists; capture per-type value columns from `RatesModifyNew2.aspx` after ticking a type).
   - Seasons, Equipment, Users/UserGroups.
   - Edit/delete for payments, adjustments and commissions.
   - Rental "Inspection Comparison".
   - S3 uploads (scanned IDs, vehicle photos).
   - Email/SMS (buttons are disabled with tooltips).
5. **Pricing**: only the "Standard" rate type is exact. Others are approximate and the UI shows a warning (`lib/pricing.ts`).
6. **Data migration** from RentCentric (CSV import, per spec). Every model has a `legacyId` field. The `registrationChannel` mapping bug noted in the spec still needs fixing.
7. **Deployment** (AWS ECS Fargate, RDS ca-central-1, S3) is not set up. Code is on GitHub at egmadotin/Mr.Rent_A_Car (commit as EGMA, no Claude co-author line).

## Verification method used

For each module:

1. Open the matching legacy screen in Chrome (read-only).
2. Pull every input's id, type and options with `javascript_tool`.
3. Build the new screen.
4. Click through it at localhost with seed data.

Legacy URLs that are useful: `VehicleAdd.aspx`, `QuotesModify.aspx?DoAction=Add`, `ReservationsModfiy.aspx?HomeToRes=Yes`, `CheckOut3.aspx?DoAction=New`, `CustomerInfo.aspx`, `AgreementMain.aspx?AgreementID=24490`, `VisualScheduler.aspx`, `RatesMain.aspx?LocationID=121&Permissions=Rates`, `MiscChargesMain.aspx?LocationID=121&Permissions=Rates`.

Note: opening some ERP pages by direct URL crashes the legacy server (e.g. ClaimsMain). Open them from the link on the parent page instead.

## Session 6 (Oct 12): real assets + better print design
User request: copy the real data from the old ERP (logo, all vehicles, vehicle-type images), store them in the new app, and use them on the invoices/prints. Print design should keep the same content as the legacy documents but look better (no need to match the old layout pixel for pixel).
- Images are stored in `apps/web/public/legacy/` (logo + vehicle-type photos), referenced via `VehicleType.imageKey` / `Location.logoKey`.
- Vehicles: imported from the legacy Vehicles list (`legacy/vehicles.json`) via `prisma/import-legacy-vehicles.ts`.

### Session 6 results
- **Assets in `apps/web/public/legacy/`**:
  - `logo.webp` (colour) and `logo-white.png` (dark backgrounds).
  - `wechat-qr.webp`: the WeChat QR code. It is *not* a logo; it was renamed from `logo-square.webp`.
  - `vehicle-types/*.jpg`: 23 photos from RentCentric plus 14 from the mrrentacar.com fleet page (`legacy/public_fleet_images.json`). Every active class has a photo.
- **Importers**:
  - `pnpm --filter @mrac/db exec tsx prisma/import-legacy-vehicle-types.ts`: 136 forms, keyed by name, sets `imageKey` plus the new VehicleType fields.
  - `... prisma/import-legacy-vehicles.ts`: 23 real vehicles keyed by `legacyId`. Seed vehicles are deactivated and renamed `TEST-…` if they clash.
- **Fleet coverage (resolved Oct 12)**: with Location = ALL and Active = ALL, RentCentric lists exactly the same 23 vehicles as `vehicles.json` (20 YYC, 1 Surrey, 2 Coquitlam; 6 are Sold). Nothing was missing.
- **Vehicle status**: all 17 RentCentric statuses (Sold, In Repair, Stolen …) are in `enum VehicleStatus`. Labels and colours live in one place: `packages/api/src/lib/vehicle-status.ts` (exported as `@mrac/api/vehicle-status`).
- **Brand**: `@mrac/ui/components/brand-logo` (`BrandLogo`) swaps colour and white by dark mode. It is used in the public header, the ERP sidebar (desktop and mobile; collapsed sidebar keeps the "M" badge) and the staff login.
- **Photos in UI**:
  - Public `VehicleClassCard` (Fleet, home, booking results).
  - ERP vehicle list thumbnail (`staff.vehicle.list` now selects `vehicleType.imageKey`).
  - ERP vehicle detail "Class photo" card.
- **Print kit** (`(erp)/admin/print/_components/print-kit.tsx`):
  - `PrintHeader` (logo, red title, #number, date, address/contact strip), `PrintSection`, `InfoRows`, `VehicleCard` (photo plus spec chips).
  - `PrintChargeTable` (legacy order: Total T&M, Options Total, Sub Total, % taxes, red Total bar, payments, Balance box), `PrintFooter`, `PrintPage`.
  - **Quote print is done and verified in the browser.** Reservation and rental prints should be rebuilt on the same kit.
- **The "print 404" earlier was only a request made while the route was still compiling** (first compile takes 20–70 s on the bind mount). It was not a bug: wait and reload.
- **Reservation print** (`/admin/print/reservations/[id]`) is **verified in the browser**. It copies legacy "Print Reservation Detail" (`ReservationEmailPrint.aspx`). The Customer box falls back to the renter fields stored on the reservation (walk-ins have no customer record).
- Legacy "Print Invoice" (`ReservationPrintSelect.aspx`) has one template, "Reservation Confirmation" (AgreementFormID 595). It renders only after a postback, so it has **not** been read yet.
- Disk: C: filled up on Oct 12 and froze Docker; the user freed space (8 GB free after restart). Docker's disk image is still on C: (`docker_data.vhdx`), so watch free space. **Never remove the `kawa` Docker project** (another project of the user's).

## Oct 12–13: locations, per-location classes, editing, shared code

- **RentCentric quirk (important for any future scrape)**: list pages (`VehicleTypesMain`, `RatesMain`, `MiscChargesMain`, `InsurancesMain` …) **ignore `?LocationID=` and show the session's *current* location**, which is whatever the *previous* request selected. Any page with `LocationID=` (including edit forms) switches it.
  - Load a list **twice** and check the location name in the page header before trusting it. Never run two scrapes (or browse the ERP) in parallel.
  - The first vehicle-type scrape stored Surrey's classes under YYC because of this. Every location was re-scraped and checked against mrrentacar.com.
  - The existing `rates_/misc_/ins_/ratecal_` files for 119/120/121 were checked against the true per-location ID lists and **are correct**.
- **Per-location classes**: `VehicleTypeLocation` (class × location, with its own legacy VehicleTypeID, memo, photo, Web Customer flag, sort order).
  - `legacy/vehicle_types.json` holds all 473 per-location forms (`loc` = LocationID).
  - `legacy/public_fleet_order.json` holds the order of the mrrentacar.com fleet cards.
  - `legacy/public_fleet_type_images.json` holds the photo each card shows.
  - Online classes per location match mrrentacar.com exactly: Richmond 29, Burnaby 33, Vancouver 33, YVR 33, YYC 10.
  - Public `customer.fleet` and `customer.search` use these rows: only the location's online classes, in its order, with its photo and memo.
- **ERP editing**:
  - `/admin/vehicles/[id]/edit` reuses `VehicleForm` with `initial`; `staff.vehicle.update` writes an audit row for each changed field.
  - `/admin/settings/locations`: edit every location field, plus the Active and On-website flags.
  - `/admin/settings/vehicle-types` and `/[id]`: class fields, plus a per-location table (offered / online / memo / order).
- **Shared code**:
  - `(erp)/_components/list-kit.tsx`: `useListState`, `ListSearch`, `ListStatusRow`. Used by the quotes, reservations, rentals, customers and vehicles lists and by the settings lists.
  - `(erp)/_components/booking-kit.tsx`: `ChargeSummary`, `FormAlert`, `DiscountField`, `bookingWindow`, `initialBookingTimes`, `tzLabel`. Used by the quote and reservation forms.
  - `FieldShell` in `form.tsx` is exported (optional `errorKey`).
  - Fixed along the way: reservation edit showed times in Vancouver time but saved them in the location's zone (1 h shift at YYC).
- **Rates / charges / insurance for Richmond, Burnaby, Vancouver, YVR**: being scraped into `rates_/misc_/ins_<loc>.json` (generic scraper, ISO dates).
  - The rate form itself prints per-class Hourly/Daily/Extra/Weekly/Monthly + km (`vehicleRates`). `import-legacy-rates.ts` stores those for each of the rate's seasons; Rates Calendar snapshots (YYC/Surrey only) override them.
  - The importers' `LOCATIONS` maps now cover all locations.

### Pricing status (Oct 13) — done for now; the client will send a price master sheet

- **The public search matches mrrentacar.com exactly: 77/77 results** (Richmond, Burnaby, Vancouver, YVR, YYC; Oct 20–23, 2026). Classes, order, price to the cent, km included, extra-km charge. Comparison data: `legacy/tools/live/`.
- The live results show the **rental (time) charge only**. `customer.search` now returns `price` (headline) plus `total` (estimate with fees and taxes).
- `RateValue` money columns are `Decimal(16,8)`: RentCentric keeps rates unrounded and rounds only the total. The rate-form values (`vehicleRates`) are preferred; Rates Calendar values only fill gaps (and are cent-rounded, hence the monthly/30 workaround in `pricing.ts` for those rows only).
- Per-class extra-km charge (`RateValue.extraKmCharge`, 0 is a real value).
- Charges with Min/Max Days are skipped outside that length (e.g. monthly-subscription fees only on 32+ day rentals).
- Taxes per location follow RentCentric Settings > Taxes (`legacy/taxes.json`): BC = GST + PST + PVRT, YYC = GST.
- **User, Oct 13:** prices change every 2–3 days; the client will provide a price master sheet. **Don't spend more time on rate scraping.** Priority now: quotes / reservations / rentals forms (create, edit, view) identical to the old ERP, then the public booking flow, then editable invoice / agreement templates with permission-based edit/delete. Compare every step with screenshots; add nothing that isn't in the old system.

### Quotes — matched to RentCentric (Oct 13), screenshot-compared

- **Add/Edit Quote** (`quote-form.tsx`) = `QuotesModify.aspx` field for field: Pickup Date*, Return Date*, Pickup Location*, Return Location*, Company (search box, `CompanySearch`), Vehicle Type*, Rate* (list "CODE ($daily)"; the list for Surrey/Standard is identical to RentCentric), Discount % (blank/%/$ + value), Referral (+ ⊕ Quick Referral Add = `ReferralsQuickAdd.aspx`: Referral/Company Name, Full Name, Email, Phone, Fax, Memo), options grid (Option Name / Type / Rate), Add/Edit Other Charges (4 × Amount / Detail list = Settings > Payment Details / description), **Generate**.
  - Removed my additions: the "Quote contact" card (contact is entered on Email/SMS Quote, as in RentCentric) and the live "Charges" sidebar.
- **Options grid** (`options-grid.tsx`): name / "Insurance" | "Misc. Charge" | "Tax" / rate only (no "/day", no deductible text); single-member groups are tick boxes; plain character sort; defaults re-ticked when location or type changes. Surrey/Standard grid now differs from RentCentric only by **data**: RentCentric groups by a numeric group id that the edit forms don't expose for some groups (Misc-7 "BC to MT Use / BC to CA USE / BC to NV / BC, AB to MT USE / Out of Province WAORCANV", Misc-43 "SLC Declines / Supplemental Liability Coverage 1M"), and "*Optional Damage Waiver Credit" is ($24.95) there vs $0.00 here. Fix with the client's charge master sheet (or by reading the grid's radio `name`s per location).
- **Quote view** (`quotes/[id]/page.tsx`) = `QuoteMain.aspx`: the ten fields (Quote Date, By, Pickup Date, Return Location, Customer Name, Company, Return Date, Equipment Type, Pickup Location, Total), actions Edit / Email Quote / SMS Quote / Print Quote / Make New Reservation / Start Rental, single Memo box + Save, charges table "Total T&KM".
- **Charge table order** (`PrintChargeTable`, all prints and views): fixed-amount taxes (PVRT) now come after "Options Total", before "Sub Total", as in RentCentric.
- **Email Quote** = `EmailQuoteRW.aspx` (First Name* · Last Name · Email · Cc · Phone · 3 attachments · Notes · Send Email). **SMS Quote** = `SMSQuoteRW.aspx` (First*, Last*, Email*, Cell Phone*, Provider = the 70 carriers in `@mrac/ui/lib/sms-providers`, generated message "Quote: N, From …, Vehicle …, Date: … to …, Total …, Phone: …, Website:…", Send Message). Not built: the ⊕ add-provider next to Provider.
- **Quotes list** = `QuotesSearch.aspx`: quick search "Quote # OR First Name OR Last Name", Advanced Search (Quote#, Quote Date Start/End, Location default = working location, First Name, Last Name, Phone), columns Quote# (+ "Expired" after `Location.quoteExpiresAfter` days, imported from RentCentric), Quote Date, Full Name, Phone, Location Name, Delete; Print, Export to Excel; 200 rows; sorted by Quote Date ascending; filters apply on Search.
- Still to do for quotes: the Print Quote / email body template (RentCentric `PrintQuoteRW.aspx` layout, editable template — part of the templates phase); dates are shown in our locale format (RentCentric uses "12/13/2024 2:46 PM").
- **Next: Reservations** (ReservationsSearch.aspx, add/edit form, ReservationMain.aspx view), then Rentals (AgreementsSearch.aspx, CheckOut3.aspx, AgreementMain), then the public booking flow, then editable invoice / agreement templates + permissions.

### Reservations — matched to RentCentric (Oct 14), screenshot-compared

- **List** = `ReservationsSearch.aspx` (quick search + Advanced Search: Reservation#, First/Last Name, Vehicle ID, Phone Number, Vehicle Type, Loc. Name (default = working location), Company Name, Pickup Date Begin/End, Loc. Out, Loc. In, Status (Honored / Confirmed / Cancelled / Tentative / Pending / Null — no Pending/Null exist here), National ID/SSN; columns Reservation#, First/Last Name, Pickup/Return Date, Pickup/Return Location, Vehicle Type, Vehicle, Status; Print / Export to Excel; 200 rows; Reservation# descending). Shared bits in `list-kit.tsx`: `LegacySearchBar`, `SearchField`, `ListExportButtons`, `exportCsv`, `legacyDate`.
- **Reserve form** (`reservation-form.tsx`) = `ReservationsModfiy.aspx`: Customer tab (Swipe, First*, Middle, Last*, Driver's Lic.#*, Lic.Exp*, Lic.State* (BC), Date of birth*, Address 1/2, City, Zip/Postal, Country* (Canada; RentCentric's 250-entry list in `@mrac/ui/lib/countries`), State/Province* (BC), Phone*, Local Phone, Email*, Policy Number, Insurance Company/Expiration/Phone/Fax, Customer Notes, "Save and Goto Reservation Tab >>") and Reservation tab (Reservation Date, Reservation # Auto, First*/Middle/Last* + Check Matching, Email, Phone*, Location*, Pickup Location*, Return Location, Pickup Date* + X Days, Return Date*, Vehicle Type*, Company (search, Clear), Rate*, Vehicle (search), Discount %/$ + Reason, Deposit:, Delivery Address, Referral (+), Driver, Airline, Flight #, Hotel, Arrival Aiport, Prefered Language, PO#, RO#, Customer Notes, Memo + popup tick, Non-Revenue, options grid (shared with Add Quote), status tick boxes Confirmed/Tentative/Cancelled/Rented/Checked In, Send Confirmation Email, Is Loaner, Save; right: Update Charges Summary + Payment Information (Swipe, Credit Card, CVV (never stored), Payment Method*, Amount*, Transaction Type (Authorization), Authorization/Transaction Code, Submit)). Defaults 9:00 AM today → 9:00 AM tomorrow; Add Quote defaults to now (as in RentCentric).
  - API: `reservation.create/update` take `options` (bookingOptionsInput, same as quotes), status Tentative/Confirmed/Cancelled, `sendConfirmationEmail` (logged as memo until an email provider exists).
  - Not built yet: Customer tab "Add More Information" link and "Drivers / Add More Drivers" (drivers exist on the reservation page); Credit Card (+) saved cards; Rate (i) info.
- **Reservation page** (`reservation-detail.tsx`) = `ReservationMain.aspx`: field grid (Status, Type, Return Location, Entered By, Reservation Date, Reservation Channel, Company / Vehicle, Pickup Date, Pickup Location, Return Date, Flight Details), the 14 action links in RentCentric order (Payments/Charges, Additional Drivers, Bill Split, Pickup/Drop-off open their panels; Cancel/Move/Delete/Duplicate work; Print Invoice, E-Mail Reservation Details, Email Reservation Form/Invoice, Reservation Inspection are disabled until the templates/email step), Memo, charges table with Total Payments + Balance.
- **Machine note**: the PC had 0.5 GB free RAM of 15 GB (Kawa + waviso containers + Chrome); the Next dev server compiled for minutes and once hung — `docker compose restart dev` and start `pnpm dev` again.
- **Next: Rentals** (`AgreementsSearch.aspx`, Start Rental / `CheckOut3.aspx`, `AgreementMain.aspx`, End Rental), then the public booking flow, then templates + permissions.

### Rentals — matched to RentCentric (Oct 14)

- **List** (`rentals-list.tsx`, titled "Rent") = `AgreementsSearch.aspx` with all its Advanced Search filters.
- **Start a Rental** (`rentals/new/start-rental-form.tsx`) = `CheckOut3.aspx?DoAction=New`, screenshot-compared. Customer tab in the legacy order (First*, Middle, Last*, Address 1 / Address 2, City, Zip/Postal, Country / Province/State, Phone*, Local Phone, Email* / Employer Phone, Driver's Lic. #*, Lic.State*, Date Of Birth* / Driver's License Expiration*, Insurance Company, Policy Number, Insurance Exp. / Insurance Phone, Insurance Fax, Customer Notes, "Save And Goto Rental Tab >>"). Rental tab: Rental # Auto, Pickup Date + X Days, Return Date (default now → +1 day, as RentCentric), Pickup/Return Location, Vehicle Type, Company, Rate, Discount + Reason (None), Deposit:, Vehicle ID (search; fills Odometer Out and Fuel Out from the vehicle), Odometer Out*, Buy Prepaid Fuel @ $2.00 Per Gallon, Fuel Out slider 0–16, Referral (+), Claim#, AirPort, Airline, Flight #, PO#, RO#, Rental Reason (None), Opened By (current user), Memo, Non-Revenue, memo popup tick, options grid; right: Update Charges Summary + Payment Information (Authorization / Payment (Credit) / Refund -(Credit), Auth Code, Trans Code); bottom "Please Select Rental Printout*" (Open Contract) + "Complete And Print Rental". Tested: rental #3 created, total matches the preview, vehicle ON_RENT.
  - API `rental.startWalkIn` (renter always saved as a customer, same pricing as quotes/reservations). Customer validation shared in `packages/api/src/lib/customer-input.ts` (reservations use it too).
  - Shared UI `_components/booking-customer.tsx`: `CustomerFields` (per-form legacy layout + labels), `CustomerNotes`, `MatchList`, `PaymentInfoCard`, `customerValues`. Reserve form uses them.
  - `?print=<printout>` is passed to the rental page; printing waits for the templates step. Not built: Add More Information, Drivers / Add More Drivers, Add/Edit Other Charges >> button, Long Term Rental / Invoicing Period (hidden in RentCentric by default).
  - Rental page dates now show in the pickup location's time zone.
- **Rental view** (`rentals/[id]/_components/rental-detail.tsx`) = `AgreementMain.aspx`: "Rental# n" + Edit; fields Status (Closed (date)), Type, Pickup/Return Date, Opened By, Check-Out Channel, Company, Customer Balance | Vehicle, Pickup/Return Location, Referral, Closed By, Check-In Channel, Split Bill Balance; the 23 action links in RentCentric order (each opens its panel — the old tab sections, filtered with a `show` prop — or its dialog from `rental-dialogs.tsx`; Email/Inspection disabled until templates/inspections); Memo + Memo History (n) + Save; charge table with payments (legacy "Visa XXXX0583(P) Auth:…" / "Auth:…" wording) and Balance. `%` charges show as % everywhere (`_lib/charge-lines.ts`). Shared `DL` / `ActionLink` in `_components/legacy-view.tsx` (reservation view uses them too).
- **Edit Rental** (`rentals/[id]/edit`) = `Checkout3.aspx?CustomerID=…&AgreementID=…`: the Start a Rental form in edit mode, opened on the Rental tab; adds Expected Return, Return Date / Odometer In / Fuel In (closed rentals), Fuel Charge, Upgrade Type (Flat/Daily) + Upgrade Amount, Damage (disabled until damage records exist); Vehicle ID and Deposit locked (vehicle changes via Vehicle Exchange); Save. API `rental.update` re-prices (`priceBooking` now takes `upgrade` and `fuelCharge`) and keeps tickets, admin, damages, prepaid fuel and adjustment lines. Not matched: the old unlabeled 1–16 slider under the vehicle description on the edit form.
- **End Rental** (`rentals/[id]/edit?end=1`): the Edit Rental form with the check-in fields required (Return Date defaults to now in the pickup location's zone, Odometer In, Fuel In defaulting to Fuel Out), Fuel Charge / Upgrade, printout picker and "End Rental"; `rental.update` with `close: true` re-prices to the actual return and closes via the shared `closeRental()` (same as `rental.end`). Tested on rental #3. **Not verified against RentCentric**: the live ERP has no open rental (End Rental is disabled on closed ones) and creating one there isn't allowed, so the exact close-screen wording / printout list must be checked when the client next closes a rental (ask for a screenshot).
- Pricing note: for a sub-day rental, daily misc fees are prorated (Concession Fee 2.99 → 1.20 for 9.5 h) while the time charge is 1 Daily. Existing `priceBooking` behaviour — confirm with the client's price master sheet.
- Templates editor in RentCentric: Settings > Rental Contracts & Invoices > Rentals & Invoices = `AgreementFormsMain.aspx?LocationID=…` (for the templates step).
- **Next**: the public booking flow, then templates + permissions.
