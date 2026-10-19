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
- **Fast local testing (production mode)**: dev mode compiles each page on first open (1–3 min each on this PC, <1 GB free RAM), so clicks seem dead. For clicking around, build once and serve:
  `docker compose exec -T dev sh -c "cd apps/web && npx next build --no-lint"` then `docker compose exec -d dev sh -c "cd apps/web && npx next start -p 3001 > /tmp/next.log 2>&1"`. Pages then open instantly; after code changes, rebuild (or switch back to `pnpm dev`). Stop the server with `docker compose restart dev`.
- Dev file watching ignores `packages/db/prisma/legacy`, migrations, `.git`, `.next`, `.claude` (next.config.ts) — the large legacy JSON files were triggering slow re-scans.
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
- **End Rental** (`rentals/[id]/end`) = RentCentric `CheckIn2.aspx?CustomerID=…&AgreementID=…` (checked against live YYC rental 70000585, view only): Pickup Date text; Expected Return Date*, Return Date* (now); Pickup Location (text), Return Location; "Vehicle (year make model (ID))"; Odometer Out*, Odometer In* (pre-filled with Out); Fuel Out / Fuel In sliders (In = Out); View Rates & Charges (→ Edit Rental), Damage (disabled); Company; Payment Information (Card #, CVV, Payment Method*, Amount* = balance, Transaction Type, Submit → rental.addPayment); right: Update Charges Summary (re-price preview at the Return Date) / charge table with payments + Balance; "Please Select Rental Printout*" (YYC list: Bill Split Invoice, Break Down Close, Customer Invoice, Direct Bill Invoice, Dynamic Standard, Dynamic Standard 2016, DynamicBillSplitInvoice, DynamicCustomerInvoice, Open Contract*, Standard) + End Rental. Saves with `rental.update({ close: true })` (re-prices, then shared `closeRental()`). Values from `rentals/_lib/rental-form-values.ts` (shared with Edit Rental); payload from `rentalFields()` in `start-rental-form.tsx`. Tested Oct 16 on rental #3: closed, re-priced to 3 days, vehicle Available, "Print Open Contract" banner; printout list = the location's active templates.
- Legacy differences to handle later: payment methods differ per location (YYC adds Cheque, Direct Bill Company — not in our enum); printout lists differ per location; payments in the charge table have Capture / Refund links (with Stripe).
- Working location in RentCentric: `home3.aspx?locationid=<id>` switches it (this login sees Coquitlam, Surrey, YYC in the header menu; others reachable by id).
- Pricing note: for a sub-day rental, daily misc fees are prorated (Concession Fee 2.99 → 1.20 for 9.5 h) while the time charge is 1 Daily. Existing `priceBooking` behaviour — confirm with the client's price master sheet.
- Templates editor in RentCentric: Settings > Rental Contracts & Invoices > Rentals & Invoices = `AgreementFormsMain.aspx?LocationID=…` (for the templates step).
- **Next**: the public booking flow, then templates + permissions.

### Public booking — live mrrentacar.com flow (captured Oct 15, read-only)

1. **Search** `GET /select-vehicle/?pickup-location=126&drop-location=126&pickup-date=10/20/2026&pickup-time=10:00 AM&drop-date=…&drop-time=…&promoCode=` (126 = YVR). Left filters: Vehicle Type, Luggages, Doors, Seats; "Change Booking Info"; Sort (Alphabetic); cards: class, seats/luggages/doors, sample models, "900 Km included. Additional at $0.00", total price, **Reserve Now** (`data-car-id`, `data-rate-id` = rate code, e.g. "INT Fall End 3 to 5 Days").
2. **Rental Options** `GET /rental-options/?vehicle-type=<carId>&rate-id=<rate code>&pickup-location=…&drop-location=…&pickup-date=…&pickup-time=…&drop-date=…&drop-time=…&promoCode=&isPayNow=&reservationBy=`. Steps bar "1 PICK-UP / SELECT VEHICLE · 2 RENT EXTRA OPTIONS / EXTRA OPTIONS · 3 YOUR CONTACT DETAILS / CONTACT INFORMATION". Left: locations + dates box, vehicle image + class name. Right: charge summary (Rental Charges, chosen protection, chosen/default misc, amount taxes, Sub Total, % taxes, Total). **Protections & Coverages**: one radio per insurance (icon, NAME (Details), price for the period; default "No Protection" ticked). **Choose Extra Options**: two-column checkboxes, each misc charge with icon + UPPERCASE name + price for the period; location defaults (Premium Location Charge, Regular-hours pickup, Vehicle Licence Fee) ticked and disabled. Icons: `https://www8.rentcentric.com/Client6270/images/MiscChargeID<id><file>.png` / `InsuranceID<id>….png`. Button "Continue" (`#rc-reservation-next-step`).
3. **Reservation Information** `GET /reservation-information/?…&misscchs=924,965,324,&inssurces=248,&vehicleName=Economy`: same steps bar + summary; "Customer Information": First Name*, Last Name*, Email*, Phone*, Birth Day* (default 01/01/2000), Address*, City*, State/Province*, Country* (Canada, 259 entries), Zip/Postal Code*, Driver License Number*, Driver's License Exp.*, Driver's License State*, Credit Card Type* (Amex / Discover Card / Mastercard / UnionPay / Unknown / Visa), Credit Card Number*, Card Holder*, CVV*, Expiry Month*, Expiry Year*, Special Request/Local Information; "Terms & Conditions" ☐ I accept the rental policy; hCaptcha; **Reserve**. (Reserve not clicked — it creates a real reservation.)

### Taxes and online defaults — now exact (Oct 15)

- **Tax rules**: each % tax in RentCentric (TaxesModify.aspx) has "Apply to" ticks (Time, Mileage, Misc, Insurance, Taxes, Fuel, Damage, One Way, Other I–IV) plus ticked lists of misc charges, insurances and taxes. Copied for all 7 locations into `legacy/tax_rules.json`, imported onto `LocationTax` (`hasRules`, `appliesTo`, `miscChargeIds`, `insuranceIds`, `taxIds`, `legacyId`) by `prisma/import-legacy-tax-rules.ts`. `priceBooking` taxes only the lines a tax applies to and **rounds per line, half-to-even** (.NET default) — e.g. YVR GST 7.88 not 7.89; YVR PST excludes PVRT and insurance. Taxes without rules keep the old whole-subtotal %.
- **Online defaults**: the public site only adds defaults that are also "Web Customer" (`priceBooking({ online: true })`); staff keep all defaults. (Energy Recovery Fee, BC Local Use, EV fees are staff-only defaults at YVR.)
- Verified exactly against mrrentacar.com YVR Economy Oct 20–23: no options 176.36; SLC + Booster 290.86 (every line equal). Check script: `legacy/tools/check-yvr.ts`.
- **Option icons**: `legacy/option_icons.json` → `MiscCharge/Insurance.imageKey` (RentCentric image URLs, as the live site uses) via `prisma/import-legacy-option-icons.ts`.
- **Booking UI**: `/book/options` rebuilt to the live "Rental Options" layout (banner, 3-step header, booking box + vehicle, live-style summary, Protections & Coverages radios, Choose Extra Options with icons, defaults ticked + disabled, Continue). Shared `book/booking-summary.tsx`, `book/steps.tsx`. Results page has no step header (as live).
- **Reservation Information** (`/book/details`) = live step 3: banner, 3-step header, same summary, "Customer Information" (First/Last Name, Email, Phone, Birth Day 01/01/2000, Address, City, State/Province, Country (Canada), Zip/Postal Code, Driver License Number, Driver's License Exp., Driver's License State — all required), Special Request/Local Information, "Terms & Conditions ☐ I accept the rental policy", Reserve. `customer.requestReservation` saves the profile on the customer and uses the birth date for under-age fees. Tested: reservation #9, total 176.36 (= live). **Not built (decision needed)**: the live Credit Card Type / Number / Card Holder / CVV / Expiry fields (we must not store card numbers — needs a payment provider or a "pay at counter" policy), hCaptcha (honeypot for now).
- YVR has 6 open rentals in RentCentric (header ONRENT) — use one to check the End Rental screen (view only).

### Card payments — Stripe (Oct 15, user decision)

- **Settings > Payment Settings > Payment Gateway** (`/admin/settings/payment-gateway`, admins only via `adminProcedure`): Active, Test mode, Publishable key, Secret key, Webhook signing secret (optional), Online bookings = "Save the card" (SetupIntent, charge at the counter) or "Authorize" (manual-capture PaymentIntent for the total). Secrets are AES-256-GCM encrypted (`packages/api/src/lib/secrets.ts`, key from `PAYMENT_SECRETS_KEY`, falls back to `BETTER_AUTH_SECRET` — set a dedicated one in production; changing it means re-entering the keys), write-only (shown as `sk_test_…1234`), audited. "Test connection" calls Stripe `accounts.retrieve`.
- **Website step 3**: when the gateway is active, Stripe's Payment Element replaces the live site's card fields (card data goes straight to Stripe). Reserve → `customer.prepareCard` (Stripe customer + Setup/PaymentIntent) → browser confirms → `customer.requestReservation({ stripeIntentId })` verifies the intent server-side, saves a `CreditCard` (brand, last 4, expiry, `processorToken` = payment method) and, in Authorize mode, an AUTHORIZATION `Payment` (transactionCode = PaymentIntent id). Total held must equal the reservation total. Gateway off → booking works without a card, as before.
- RentCentric's own gateway page (Settings > Payment Settings > Internet Payment Gateway, `InternetCreditCardProcessorsModify.aspx?LocationID=…`) is a per-location "Payment Gateway" dropdown (none / Cardknox; none set at YYC). Ours is one Stripe gateway for all locations — make it per-location if the client needs different Stripe accounts. Old Payment Settings also has Payment Methods, Default Payment Method and Payment Details (not built).
- **Not tested against Stripe yet** — needs the client's (test) keys entered in the settings page. Still to do: capture/charge saved cards from the ERP (Payment Information "Credit Card ⊕"), refunds, webhooks.

### Templates — Rentals & Invoices (Oct 16)

- RentCentric: Settings > Rental Contracts & Invoices > Rentals & Invoices = `AgreementFormsMain.aspx` / `AgreementFormsModify.aspx` (per location; the list shows the **session's** location). Templates are HTML (stored URL-encoded in a RadEditor) with placeholders `##<code>##`; the editor's tree maps 451 codes → names (`AddDriver1Address(195)` …). Copied read-only: `legacy/templates_120.json` (actually Surrey's set, IDs 504–531 + 595) and `legacy/template_fields.json`.
- Ours: `DocumentTemplate` (location, name, kind AGREEMENT/RESERVATION/QUOTE, html, active/default/auto-print/email-friendly), imported by `prisma/import-legacy-templates.ts [file] [locationId]`. Code table `packages/api/src/lib/template-codes.ts` (generated); fields filled by `template-fields.ts` (`rentalTemplateFields` covers the 178 codes the active templates use: agreement, dates, odometer/fuel, customer, drivers, location, vehicle, company, charges by unit, numbered insurances / misc / taxes / other charges, totals, payments/card, ChargesSummaryTable). Router `staff.template` (list, byId, fields, save/delete = admin, renderRental by id / RA# / name / raw html).
- Printing: `/admin/print/rentals/[id]?t=<template name>` renders the template (picker on top; falls back to the built-in layout). Start a Rental / End Rental printout pickers list the location's active templates (`_components/printout-select.tsx`); after saving, the rental page shows "Print <name>".
- Editor: `/admin/settings/templates` (list) and `/admin/settings/templates/[id]` (settings, HTML, searchable placeholder list that inserts at the cursor, live preview by Rental #, delete). Only admins save.
- All 7 locations copied (`legacy/templates_loc<legacyId>.json`, switched with `home3.aspx?locationid=<id>`; Surrey = templates_120.json) and imported: 302 templates, 104 active. Names can repeat within a location (as in RentCentric). Still to do: reservation/quote rendering (Reservation Confirmation, HTMLReservation); the ASPX built-ins (Standard, Customer Invoice, Bill Split Invoice) have no editable HTML — rebuild from the client PDFs in the repo root if needed; email sending.
- Oct 16: reservation printouts use RentCentric's **reservation** field numbering (`legacy/reservation_template_fields.json` → `RESERVATION_TEMPLATE_CODES`; e.g. 79 = CustomerFirstName); `staff.template.render({ kind, id | number, name | templateId | html })` for AGREEMENT / RESERVATION / QUOTE; reservation & quote print pages keep the standard layout and offer the templates in a picker. Field formats match RentCentric's printed contracts (Open Contract and Close contract format.pdf): "Rental In"/"Rental Out", "18:00, Tue, Mar 25, 2025", Due Back "3/26/2025 7:00:00 PM", "$2,248.75", "-$20.00", Dropoff Office = return address, Bill To "None", Extra KMs = driven − allowed, rate table printed for unused units, tax codes per location (`LocationTax.code`, e.g. "PVRT $1.5@Day G").
- Built-in printouts rebuilt from the client PDFs: **Customer Invoice** (`prisma/templates/customer-invoice.html`, shared, via `prisma/import-builtin-templates.ts`). Standard and Bill Split Invoice have no PDF yet — ask the client for a printed sample.
- Oct 19: line-by-line check against both PDFs. Location now stores RentCentric's Legal Name ("Mr Rent A Car", contract header = LegalLocationName), GST Number (867598294, under the address on the Customer Invoice) and the fuel prices (Convenience ReFuel / Diesel, Prepaid / Diesel; "ReFuel: $3.59/L" = FuelRate), imported by `import-legacy-locations.ts` and editable in Settings > Locations. Website prints "http://www.mrrentacar.com"; Traffic Tickets prints $0.00 when none. As in RentCentric, the Open Contract has 4 misc-charge slots and no fuel slot, so a 5th misc charge or a fuel charge isn't printed there (it is on the Customer Invoice).

### Email (Oct 16)

- **Settings > Website & Email Setup > Email Setup** (`/admin/settings/email`, admins): SMTP server, port, SSL/TLS, username, password (AES-encrypted, write-only), From name / email, BCC, Active, "Send test". Model `EmailSettings` (one row); every send is logged in `EmailLog` (SENT / FAILED + error).
- `lib/mailer.ts` (nodemailer, `sendMail`), `lib/email-document.ts` (`emailDocument`: render a rental / reservation / quote with its location's template — named, default, or first active — send, log, and note it on the record).
- Wired: rental page "Email Agreement/Invoice"; reservation page "E-Mail Reservation Details" / "Email Reservation Form/Invoice" (dialog `_components/email-document-dialog.tsx`: To, Subject, Printout, Message) and "Print Invoice" (= Reservation Confirmation template); Reserve form "Send Confirmation Email" sends after saving (failure → note on the reservation, the save stands); Email Quote sends the shared **Quote** template (`prisma/templates/quote.html`, added by `import-builtin-templates.ts`; Cc as 2nd recipient, Notes as message). SMS Quote still only logs (the provider list has carrier names but no gateway addresses — needs an SMS provider decision).
- Not tested against a real mailbox yet — needs the client's SMTP account (e.g. a Gmail / Microsoft 365 app password) entered in Email Setup.

### Users & permissions (Oct 17)

- RentCentric: Settings > Users = `AdminsMain.aspx`; User Groups = `AdminGroupsMain.aspx` / `AdminGroupsModify.aspx` (Counter, Supervisor, Junior Admin). Each group: Description, Location (ALL or one), Max Discount (% / $), Active and ~150 permission ticks in sections (Customers, Quotes, Reservations, Rentals, Credit Cards & Transactions, Rates, Insurances, Misc Charges, Locations, Reports & Administration, templates, Claims, Companies, Corporate Discounts, Bill Split, Vehicles, Maintenance, Repairs, Repair Orders, Vehicle Problems, Carwash, Damages, Accidents, Users, Commissions, Notes, Traffic Tickets …). Copied read-only to `legacy/admin_groups.json`, imported by `prisma/import-legacy-user-groups.ts` (Counter 11 perms / 15 %, Supervisor 95 / 50 %, Junior Admin 43 / 10 %).
- Ours: `UserGroup` (legacyId, name, isActive, locationId, maxDiscountType/Value, permissions = RentCentric checkbox ids). Catalog `packages/api/src/lib/permissions.ts` (sections + labels, `can()`, `permissionLabel()`). Users with role `admin` = "Full Admin" (everything).
- Server: `permitted(...perms)` procedure (trpc.ts) on quote / reservation / rental / customer / vehicle / settings / template actions (view, add, edit, delete, cancel/void, start/end rental, reopen, unvoid, adjustments, tickets, claims, bill split, commissions, settings saves); inside actions `requirePermission()` (cancel reservation, refund, edit closed rental, end rental via edit, notes) and `requireDiscountAllowed()` (group Max Discount on reservations / rentals). Payment Gateway and Email Setup stay admin-only. Tested: a Counter user is refused rental delete, quotes, users; allowed reservations.
- UI: Settings > Users (`/admin/settings/users`: list, Add user with temporary password, Edit group / default location / Full Admin / Active / password reset) and Settings > User Groups (`/admin/settings/user-groups`: sections of ticks, Check All Boxes, Max Discount, Location, Active). `useCan()` (`_components/permissions.tsx`) disables rental / reservation actions the group can't do.
- To do when real staff are imported: assign each user a group (users without a group can do nothing but what admins grant). Location restriction (group Location) is stored but not enforced yet.
