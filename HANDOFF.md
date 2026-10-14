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

## How to run (everything heavy runs in Docker; the D: drive is nearly full)

```
docker compose up -d                       # Postgres on localhost:5442 + dev container
docker compose exec dev pnpm install
docker compose exec dev pnpm db:migrate     # prisma migrate deploy
docker compose exec dev pnpm db:seed        # reference data + fake TEST records
docker compose exec -d dev sh -c "cd apps/web && pnpm dev > /tmp/next.log 2>&1"
# http://localhost:3001 (public), http://localhost:3001/admin (ERP). Host port 3001: the user runs another project on 3000.
```

- **Dev staff login**: `staff@mrac.test`. The password is in `packages/db/prisma/seed.ts` (it's a test value).
- `node_modules`, the pnpm store, `.next` and the Postgres data all live in Docker volumes. Don't `pnpm install` on the host.
- **Typecheck**: `docker compose exec -T dev sh -c "cd apps/web && npx tsc --noEmit"`.
- **Lint**: `docker compose exec -T dev sh -c "cd apps/web && npx eslint app"`. Both are clean as of this handoff.
- **Dev server gotchas**:
  - It uses webpack (`next dev`, no turbopack): Turbopack doesn't see file changes on the Windows bind mount.
  - First compile of each page takes 30–60 s.
  - **After any Prisma schema change, restart the container** (`docker compose restart dev`, then start dev again). Otherwise the server keeps the old Prisma client, and new models are `undefined` at runtime.
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
| Walk-in rental | `/admin/rentals/new` | Redirects to the reservation form with `start=1` → opens Start Rental after save |
| Public site | `/`, `/fleet`, `/our-locations`, `/contact-us`, about/services/blogs stubs | Real location hours and contacts and class specs from mrrentacar.com. One `BookingWidget` (hero/panel/compact). Redirect `/about-mr-rent-a-car` → `/about-us` |
| Public booking | `/book` → `/book/details` → `/book/confirmed` | Priced results (tested), details form (renders). `customer.requestReservation` creates a TENTATIVE reservation with channel "Website" and no payment |

## Left off exactly here

The public booking submit is **verified**. Test reservation #7:
- Status: TENTATIVE.
- Channel: "Website".
- Age, promo code and notes are stored in `customerNotes`.

Next steps, in order:

1. **Add the missing "Rental Options" step.** The live site has a step between Select Vehicle and the details form, at `https://www.mrrentacar.com/rental-options/?vehicle-type=…&rate-id=…`, where renters choose add-ons. Our flow skips it.
   - Capture its options read-only.
   - Add it as `/book/options`, using MiscCharge with `miscCharges` in `priceBooking`.
   - Extend `customer.requestReservation` to accept the chosen add-ons.
   - The URL also shows `isPayNow` (Settings > Rates > "Pay Now Discounts"). Confirm with the client.
2. **Hero "Find a car" button**: it didn't navigate in one test (possibly clicked before hydration). Re-test.


## Session 3 (Oct 12): copying the real pricing data and logic

Everything was read from the live ERP with **GET requests only**. The Rates Calendar is a read-only report; it was regenerated with different dates, and nothing was saved.

### Reference data copied and imported

The raw copies live in `packages/db/prisma/legacy/*.json`. Legacy location IDs: 120 = YYC, 121 = Surrey, 119 = Coquitlam.

- **Misc charges** (`misc_<loc>.json`): every field on MiscChargesModify (Basic + Advanced tabs) for all three locations. 346 charges.
  - Key flags: *Default MiscCharge* (added automatically, pre-ticked and locked online), *Display Online*, *Mandatory*, *Driver is underage* / *Additional Driver is added* (automatic), group (one charge per group), value pricing, effective dates, vehicle types.
  - Percentage charges exist, e.g. Premium Location Charge 9.75%.
- **Insurance coverages** (`ins_<loc>.json`): every field on InsurancesModify. 126 coverages.
  - Fields include deductible, group, the description shown on the public site, *Default Insurance* and *Display Online*.
- **Rates** (`rates_<loc>.json`): RatesModifyNew2 header fields.
  - Rate type "Min/Max+Regular" with a min/max length window (e.g. 3–6 days), seasons, weekdays, extra-km and fuel charges, online flag.
- **Rate values** (`ratecal_<loc>.json`, `ratecal2_<loc>.json`): per-type Hourly/Daily/Extra/Weekly/Monthly + km allowances, taken from Rates Calendar snapshots.
  - The rate page itself shows no values for seasonal rates. The calendar only lists a Min/Max rate when the report period fits that rate's length window, hence the second set of snapshots with several period lengths.
  - Only the Oct/Nov seasons have online rates at YYC right now (they set rates seasonally).

**Importers** (re-runnable, keyed by legacy ID):

```
docker compose exec -T dev sh -c "cd packages/db && npx tsx prisma/import-legacy-charges.ts && npx tsx prisma/import-legacy-rates.ts"
```

### Schema added
- **MiscCharge**: all legacy fields, per location, plus the vehicle types it applies to.
- **Insurance** + InsuranceVehicleType.
- ChargeKind **PROTECTION**, and ChargeLine.insuranceId.
- RateCalculation **PERCENT**.
- **Rate**: min/max days, hours and minutes, plus `availableDays`.
- **RateValue**: per season, extra-daily, km per hour/week/month, extra-km charge.
- **Season**: month/day windows.

### Pricing engine (`packages/api/src/lib/pricing.ts`), now matching the ERP
- **`pickOnlineRate`**:
  - Filters to active + Display Online rates at the pickup location that are available on the pickup weekday.
  - Keeps rates with a value for the type in the pickup date's season, where the rental length fits min/max.
  - The highest minimum wins. Verified on the live site: Standard at YYC for 3 days = 3 × the "3 to 5 Days" daily rate.
- **Protection**: the chosen coverage, else the location's Default Insurance.
- **Charges, in order**:
  1. Default charges and automatic ones (under age by "19-20"/"21-24" name range, additional driver × count).
  2. The renter's chosen extras, with one charge per group. Value pricing uses the cheapest monthly/weekly/daily mix.
  3. Percentage charges, applied to everything above them.
  4. Fixed-amount taxes, then percentage taxes on the subtotal.
- **Live check, YYC** (Standard, Oct 20–23): GST only, 9.47 = 5% of 189.47 ✓; Premium Location 16.83 = 9.75% of 172.64 ✓.

### Public booking flow
Now: Search → Choose a car → **Rental options** (`/book/options`, new) → Your details → Confirmed.
- **Rental options**: protections as a pick-one list with Details popups (the real ERP description text) and extras (included ones locked), plus a live total from `customer.quote`.
- **Details**: entering the driver's age adds the under-age fee.

### Staff reservation form
- The charge list is filtered to the pickup location.
- Default charges are added automatically.
- New "Protection" select.

### Gotchas found this session
- **`prisma migrate dev` refuses** (non-interactive) when a migration has warnings. Generate the SQL instead:
  ```
  npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url postgresql://postgres:postgres@db:5432/mrac_shadow --script > prisma/migrations/<ts>_<name>/migration.sql
  npx prisma migrate deploy && npx prisma generate
  ```
  The shadow DB `mrac_shadow` exists.
- **`apps/web/app/api/dev-ingest/route.ts`** is a TEMPORARY dev-only endpoint used to copy the scraped JSON out of the browser. **Delete it once the import is final.**
- In Git Bash, prefix docker commands that take container paths with `MSYS_NO_PATHCONV=1`.


### Session 3 results (latest)

**Done and verified against mrrentacar.com:**
- **YYC, Standard, Oct 20–23**: our total is **$198.94** and the live site's is $198.94. With SLC selected it's **$254.09** on both. Every line matches.
- **Rate picking**: the daily rate is used at full precision (monthly / 30), as RentCentric does.
- **Premium Location %**: includes the protection. Confirmed on the live site.
- **Public extras list**: only "Display Online" charges are listed. Hidden defaults are still billed but not shown when they cost $0.
- **Imports**:
  - All real rates, values and seasons for YYC and Surrey: 17 rates, 2,335 values. Coquitlam has no rates of its own in RentCentric.
  - The real percentage misc rates (Premium Location 9.75 / 13.95 / 14, Luxury Surcharge 5) were patched into `legacy/misc_*.json`.

**New staff pages:**
- **Misc charges**: `/admin/settings/misc-charges` (list, new, `[id]` edit, with the Basic/Advanced tabs as in the ERP).
- **Insurance coverage**: `/admin/settings/insurances` (same structure).
- **Master rates**: `/admin/settings/rates` (list + editor with a per-season, per-vehicle-type price grid).
- **Seasons and taxes**: `/admin/settings/seasons` and `/admin/settings/taxes` (list + dialog).
- **Not yet clicked through in the browser.** Typecheck is clean. Test them first.

**Left to do, in order:**
1. **Browser-test** the new Settings pages and the full public flow on YYC: `/book?pickup=loc_yyc&return=loc_yyc&from=2026-10-20T10:00&to=2026-10-23T10:00`.
2. **Build `/admin/settings` (the index page).** It doesn't exist yet, so the sidebar link 404s.
   - Copy the legacy category list from `LocationsMainSettings2.aspx` (17 categories, 80+ pages) with a search box.
   - Link the built pages; mark the rest "not built yet".
   - Fetch the list with GET while no long report is running: ASP.NET handles one request per session at a time.
3. **Delete `apps/web/app/api/dev-ingest/route.ts`** and `packages/db/prisma/legacy/tools/` when scraping is finished.
4. **Rate coverage**: only the Oct/Nov seasons have online rates in RentCentric today. Re-run the rate importer when the client adds new seasons, after re-scraping the Rates Calendar snapshots with period lengths 1/3/6/11/16/21/26 days.
5. **Still missing** from the old ERP:
   - Reports (~57).
   - Other Settings pages: One Way Rates, Pay Now Discounts, Rate Blocking, Overbooking, Equipment, Users, Company CRUD, Locations/hours.
   - Vehicle detail sub-screens (damage, maintenance, etc.).
   - Rental Inspection Comparison.
   - S3 uploads; email/SMS.
6. **Public site**: mrrentacar.com has no Surrey (its online locations are YVR, Richmond, Vancouver, Burnaby, YYC). Confirm with the client which locations the new public site offers.


### Session 4 (Oct 12): what changed

**Done:**
- **`/admin/settings` index** now exists: the legacy 17 categories with search across every page and an "only available" filter. Unbuilt pages are listed as "Not built yet".
- **Browser-tested**:
  - Master rates list and rate editor (real seasonal per-type prices show correctly).
  - Misc charges list.
- **PROTECTION charges** are now counted in rental Options Total, both in `totals.ts` and the charge table.
- **Importer**:
  - Retires seed-only misc charges with no legacy ID, which removes the duplicate rows.
  - Reads the `Rate` field for FLAT charges.

**~~Known gap: flat misc charges show $0.00~~ — fixed Oct 13** (`misc2_<loc>.json` re-scraped with every form field; Admin Fee GP = $100 everywhere).

<details><summary>old notes</summary>

**Known gap: flat misc charges show $0.00.**
- Affects 59 charges per location (e.g. Admin Fee GP should be $100).
- The flat amount is in the edit form's `Rate` field, which the scrape didn't capture.
- **Fix:**
  1. Log in to RentCentric.
  2. In a RentCentric tab, re-scrape only that field (GET, read-only) and post it to `/api/dev-ingest`.
  3. Write the values into `legacy/misc_<loc>.json` as `"Rate"`.
  4. Re-run `import-legacy-charges.ts`.
- Snippet:
  ```js
  // run on www8.rentcentric.com/Client6270 while logged in; loc = 119 | 120 | 121
  const out={}; for (const id of IDS) { const h=await (await fetch('MiscChargesModify.aspx?LocationID='+loc+'&MiscChargeID='+id)).text();
    const d=new DOMParser().parseFromString(h,'text/html'); out[id]=d.querySelector('[id$="_Rate"]')?.getAttribute('value'); }
  ```

**RentCentric session expired** during this session (it now redirects to the login page). Log back in before any further live cross-checks; the agent must not sign in.

**Dev note:** the occasional "Unexpected end of JSON input" overlay in dev is a webpack compile race. Just reload the page.


## Session 5 (Oct 12): module-by-module parity. **Quotes: DONE**

The user's instruction: finish one module at a time, field by field, against the old ERP (fill test data in old forms but **never save**). The **printed customer documents** (quote / reservation / rental agreement / invoice) are the most important part. Order: **Quotes → Reservations → Rentals**.

### Quotes: matched to the legacy screens
- **Add Quote**: the legacy QuotesModify.aspx fields, with Rate *required*.
  - **Rate dropdown** = every active rate at the location for the type, "CODE ($daily)". Verified identical to legacy (7 rates, same prices).
  - **Options grid**: shared component `(erp)/_components/options-grid.tsx`, data from `staff.booking.options`. Insurances, misc charges and taxes, in legacy order:
    - ungrouped items are checkboxes; grouped ones are pick-one radios with a clear (x);
    - defaults are pre-ticked;
    - taxes can be unticked (stored as `excludedTaxIds` on Quote/Reservation/Rental);
    - min/max-days filtering applies.
  - **Verified**: an exact row-by-row diff against the legacy grid (Surrey, Standard): 50/50 rows, same rates, defaults and groups.
  - **Other Charges 1–4**: amount, detail, description (lines of kind OTHER).
  - **Quote contact**: first, last, email, phone (from legacy Email/SMS Quote).
- **Pricing (`lib/pricing.ts`)**:
  - Part days for protections and charges are prorated at `round(daily/24,2)` per extra hour. Verified against legacy quote 81100002: ODW SF 30 h = $42.41.
  - Charges without an hourly rate round up to a full day.
  - Multiple insurances, tax-exempt and other charges are supported.
  - "Min/Max+Regular" counts as exact.
- **Quote detail**: legacy fields; charge table in legacy order (Total T&M / Options Total / Sub Total / taxes / Total).
  - Print quote: `/admin/print/quotes/[id]`, shared kit in `admin/print/_components/print-kit.tsx`, matches PrintQuoteRW.aspx section by section; always light theme.
  - Email Quote and SMS Quote dialogs have the legacy fields. No provider yet, so they save the contact and log a memo.
- **Quote list**: added the Advanced Search filters (date range, location).
- **Data fixes**:
  - `prisma/patch-legacy-lists.ts` applies the real rates (flat amounts, negatives, %) and Active flags from the legacy list pages (`legacy/lists.json`), plus pick-one groups from the legacy grid (`legacy/grid_union.json`).
  - Run it after `import-legacy-charges.ts`.

### Time zones: important, app-wide
- **Bookings are Canadian local time at the location.** New `Location.timeZone`: Surrey/Coquitlam `America/Vancouver`, YYC `America/Edmonton`.
- **Helpers**: `@mrac/ui/lib/tz` (copy in `packages/api/src/lib/tz.ts`). `dateTime()`, `toDateTimeLocal()` and `fromDateTimeLocal()` all default to business time.
- **Every datetime-local input** now parses with `fromDateTimeLocal`. **Never use `new Date("YYYY-MM-DDTHH:mm")`**: it uses the viewer's zone (the user is in India).
- **Date-only columns** are compared via `localDateAsUtc` (fixes an off-by-one on end dates).

### Not done for quotes
- Logo and vehicle-class photo on the print: placeholders. Real images need a decision on downloading assets.
- Quote Edit/Delete were not re-tested in the browser this session.

### Next: Reservations (same method)
1. In the legacy **Reserve** form (`ReservationsModfiy.aspx?HomeToRes=Yes`), fill test data without saving.
2. Dump every field: Customer tab, Reservation tab, payment panel, status checkboxes, pickup/drop-off modal, options grid (after location, dates and type).
3. Compare with ours.
4. Move the reservation form onto the shared `OptionsGrid` and `staff.booking.preview`; it still uses the old misc-quantity list.
</details>

5. Find the legacy **print reservation / invoice** templates on ReservationMain.aspx (Print Reservation Detail, Print Invoice, Email Reservation Form/Invoice) and build them with the print kit.
6. Then the same for **Rentals**: CheckOut3.aspx, End Rental, AgreementMain, and **AgreementsPrintSelect.aspx (rental agreement + invoice templates, the most important)**.

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
7. **Deployment** (AWS ECS Fargate, RDS ca-central-1, S3) is not set up. No git repo yet: run `git init` when the user asks.

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
