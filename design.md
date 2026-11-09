# Mr. Rent A Car — Design System & UI Specification (`design.md`)

> **One design system for the public site and the staff ERP.**
> Source: the *Mr. Rent A Car* design system artifact (v3). Stack: Next.js 15 (Turborepo) · Tailwind CSS v4 · `@mrac/ui`.
>
> **Where it lives in code**
> - Tokens & utilities: `packages/ui/src/styles/globals.css` (imported by both surfaces)
> - Fonts: `apps/web/app/_fonts/fonts.ts`
> - Shared components: `packages/ui/src/components/*`
> - Public-site building blocks: `apps/web/app/(public)/_components/ds.tsx`, `pickers.tsx`, `location-card.tsx`, `booking-widget.tsx`
> - Public-only styles (Signature wing, studio backdrop): `apps/web/app/(public)/public.css`
> - ERP-only styles (print): `apps/web/app/(erp)/erp.css`
>
> This replaces the earlier "Terra Red / parchment / Libre Baskerville" specification. None of those colours, fonts, the
> `pattern bg.png` backgrounds or the `bg-erp-*` classes are used any more.

---

## 1. Brand & vision

Mr. Rent A Car is a locally owned car rental company serving Metro Vancouver and Calgary since 1996, delivering
**premium service at every price point**.

The everyday site feels like the apps people already trust: Uber's clarity and Turo's browsable fleet. It is set in
**Inter** on clean white sheets, with one bright **Mr. Red** for the action and big, honest, all-in prices that say
"affordable" at a glance.

Premium is a deliberate moment, not the whole mood:
- The **Signature** wing switches to onyx, an elegant serif and brushed champagne for the luxury fleet.
- **Racing green** marks savings and the electric fleet.
- Every location is a first-class page, and a new city or branch is content, not new design.

The ERP uses the **same palette and components**, with slightly tighter controls and cards (see §6).

### 1.1 Tone of voice

`friendly` · `honest` · `straightforward` · `confident` · `sentence-case` · `local`

- Write like a helpful branch agent: warm, quick, never pushy. Say "Return to any of our locations.", not
  "Unbeatable flexibility!!".
- Lead with value in plain numbers, e.g. "From $39/day, taxes in."
  - Never use hype words ("best prices in town", "unbeatable"). Show the price instead of praising it.
  - No exclamation marks, no ALL CAPS.
- **Sentence case everywhere.** Buttons are verb-first: "Find a car", "Reserve", "See weekly rates", "Get directions".
- In the Signature wing the voice slows down and gets a touch more refined ("Arrive in something special."), but it
  stays just as honest about price.
- Use "we" for Mr. Rent A Car and "you" for the renter. Name places the way locals do: "YVR", "Richmond",
  "Kingsway in Burnaby".
- Name every fee before checkout, with its amount. Never write "additional charges may apply".
- Copy ships in English, French, and Simplified and Traditional Chinese. Keep strings short, use no puns, and leave
  40% room for French.

### 1.2 Core values → UI rules

| Value | UI rule |
| :--- | :--- |
| **Modern** | App-grade type (Inter), one booking capsule, three taps to a price, mobile first. |
| **Affordable** | Prices are the loudest thing on the page: "from $X/day" on every class tile, big daily rates, struck-through was-prices and green savings pills when a real weekly, monthly or promo rate applies. |
| **Customer ethics** | All-in pricing: the total with taxes and fees sits under every rate. No pre-ticked add-ons. Cancellation terms are shown before "Reserve". |
| **Best service** | Every location shows real hours, address, phone and pick-up steps. Help is one tap away in the header. |
| **Premium, when you want it** | The Signature wing (onyx, serif, champagne) for the luxury fleet. Same components, same honesty; only the ground, type and accent change. |

---

## 2. Design guidelines (the 11 rules)

1. **One app-grade typeface.**
   - **Inter** is used for everything on the everyday site:
     - ExtraBold 800 with tight tracking for headlines and prices (`type-hero`, `type-title-1…3`, `type-price`)
     - SemiBold 600 for buttons, labels and pills
     - Regular for reading
   - **Instrument Serif** (`font-serif`, `type-signature-*`) appears **only** inside the Signature wing: its hero,
     band headline, Signature card and tile titles.
   - **Geist Mono** (`type-code`) is only for location codes and confirmation numbers. It is the only uppercase text.
2. **Colour discipline.**
   - Ink on white does most of the work.
   - `brand` (Mr. Red) is the action colour: the primary button, links, the active nav underline, the hero's key
     phrase and the price tag. **At most ONE red button per view**; use the `ink` or `outline` button for the rest.
   - `racing` (green) means savings, electric or success.
   - `champagne` and the serif live only on `onyx`.
3. **Flat and quick, like an app.**
   - Sheets separate from the page by a colour step plus a 1px `line`.
   - Buttons are flat with a 1px base shadow (`shadow-primary`).
   - The booking capsule is the one resting shadow (`shadow-booking`). Cards rise 2px with `shadow-lift` on hover.
     Popovers use `shadow-floating`.
   - No glassmorphism, no blue-purple gradients, no coloured left borders. The only glows are the hero's blush corner
     and the Signature champagne glow.
4. **Shape language.**
   - `rounded-control` (12px) for buttons, inputs, icon tiles and location rows.
   - `rounded-card` (20px) for cards, tiles, banners and notices.
   - `rounded-sheet` (28px) for the hero band, dialogs and the mobile booking sheet.
   - `rounded-pill` for the desktop booking capsule, chips, badges, deal pills and the Signature buttons.
   - Strokes are 1px. Use 2px only for focus, the active nav underline and the focused booking cell.
5. **Price is the hero.**
   - The daily rate uses `<Price>` (Inter 800, tabular, small raised "$") with "/day" beside it.
   - The all-in total ("taxes and fees included") sits directly beneath it.
   - Before dates are chosen, show "from $X/day" with no total.
6. **The price ladder.** Home and location pages show `ClassTile`s cheapest first and Signature last
   (Economy → Compact SUV → SUV → Minivan → … → Electric → Signature). "From" prices come from live rate plans.
7. **Vehicles are shown "or similar".**
   - The class is the title ("Compact SUV").
   - The model line ("Kia Rio 4 Doors or similar") is in `muted-foreground`.
   - Then up to four icon specs: seats, bags, doors, electric.
8. **Imagery.**
   - Vehicle photos sit on the `studio` plate, 16:10, `object-contain`. Most class photos are JPGs on white, so the
     plate stays light and the photo uses `mix-blend-mode: multiply`.
   - Location photos (when added) should be real Metro Vancouver and Calgary scenes. Never use generic stock skylines.
9. **Layout rhythm.**
   - 1280px container with 16px gutters (32px from 640px).
   - Sections 96px apart (64px on mobile).
   - Grids: class tiles 2 / 3 / 5, vehicle cards 1 / 2 / 4, promo banners 1 / 3, with 16–24px gaps.
10. **Motion is quick and quiet.**
    - 180ms `ease-out-quick` for hovers.
    - 700ms for the 1.03 image scale on card hover.
    - Arrows nudge 3px on hover.
    - Respect `prefers-reduced-motion` (handled globally in `globals.css`).
11. **Accessible by default.**
    - Text is at least 4.5:1 on its ground in both themes.
    - Control borders use `input` (`line-field`, 3:1+).
    - Focus is a 2px `ring` (steel) offset 2px.
    - Touch targets are 44px+.
    - Status and savings always carry a word and an icon, never colour alone.

---

## 3. Typography

| Family | Variable / utility | Used for |
| :--- | :--- | :--- |
| **Inter** (variable, 400–800) | `--font-inter` → `font-sans` (default) | Everything on the site and in the ERP |
| **Instrument Serif** (400, normal + italic) | `--font-instrument` → `font-serif` | Signature wing only |
| **Geist Mono** (500) | `--font-geist-mono` → `font-mono`, `type-code` | Location codes, confirmation numbers |

The fonts are loaded once in `apps/web/app/_fonts/fonts.ts` (`next/font/google`) and applied on `<html>` by both root
layouts through `fontVariables`. The fallback stacks include Noto Sans/Serif SC/TC for the Chinese pages.

### 3.1 Type scale (utilities in `globals.css`)

| Utility | Size / line height | Weight · tracking | Use |
| :--- | :--- | :--- | :--- |
| `type-hero` | clamp(40px → 64px) / 1.03 | 800 · −0.04em | Home hero headline |
| `type-title-1` | clamp(34px → 48px) / 1.08 | 700 · −0.035em | Inner-page hero titles |
| `type-title-2` | clamp(28px → 36px) / 1.11 | 700 · −0.03em | Section titles, booking-step titles |
| `type-title-3` | 22px / 28px | 700 · −0.02em | Card groups, form sections |
| `type-price` | 30px / 34px | 800 · −0.035em, tabular | Big prices and totals |
| `type-heading` | 17px / 24px | 600 · −0.01em | Card titles |
| body-lg | 18px / 28px | 400 | Hero lead |
| body | 16px / 24px | 400 | Reading text |
| body-sm | 14px / 20px | 400 | Default UI text, ERP tables |
| `type-label` | 13px / 18px | 600 | Field labels, kickers |
| caption | 12px / 16px | 400 | Meta, table headers |
| `type-signature-display` | clamp(44px → 60px) / 1.03 | Instrument Serif 400 · −0.015em | Signature band headline |
| `type-signature-title` | 28px / 32px | Instrument Serif 400 · −0.01em | Signature card and tile titles |
| `type-code` | 12px / 16px | Geist Mono 500 · +0.08em, UPPERCASE | "YVR", "#10234" |

ERP page titles use Inter Bold at 26–28px with −0.03em tracking (`PageHeader`). Table headers are 12px semibold muted,
in **sentence case**, not uppercase.

---

## 4. Colour

All colours are CSS custom properties defined on `:root` (light) and `.dark` (dark) in `globals.css`. **Never paste raw
hex values into components.** Use the semantic utilities (`bg-card`, `text-muted-foreground`, `bg-primary` …) or the
design-system names listed below.

### 4.1 Primitives (light / dark)

| Group | Token | Light | Dark | Usage |
| :--- | :--- | :--- | :--- | :--- |
| surface | `surface-page` | `#f6f6f3` | `#0b0b0d` | The page ground: a clean, barely-warm off-white. Never pure white. |
| | `surface-sheet` | `#ffffff` | `#151517` | Cards, the booking capsule, header, dialogs |
| | `surface-sunken` | `#eeeeea` | `#1d1d20` | Hovered and inset areas, chips |
| line | `line` | `#e5e5e0` | `#2a2a2e` | 1px dividers and card borders |
| | `line-field` | `#86868b` | `#6b6b72` | Input borders (3:1) |
| ink | `ink` | `#111113` | `#f5f5f2` | Text |
| | `ink-muted` | `#5d5d64` | `#a7a7ae` | Secondary text |
| brand | `brand` (Mr. Red) | `#d0121b` | `#ff5b53` | The action colour |
| | `brand-deep` | `#a80e16` | `#ff8079` | Hover/pressed red |
| | `brand-glow` | `rgba(208,18,27,.28)` | `rgba(255,91,83,.28)` | Hero blush corner only |
| | `blush` | `#fdeeed` | `#2a1012` | Danger / error tint |
| on | `on-brand` | `#ffffff` | `#111113` | Text on a red fill. It flips to ink in dark mode, where red lightens. |
| onyx | `onyx` | `#0e0e10` | `#060607` | Signature ground |
| | `onyx-sheet` / `onyx-line` / `onyx-field` | `#17171a` / `#2a2a2e` / `#8b877f` | — | Signature cards, lines, fields |
| | `on-onyx` / `on-onyx-muted` | `#f3f0ea` / `#b0aca4` | same | Text on onyx |
| champagne | `champagne` | `#c8a66e` | same | Signature accent and buttons |
| | `champagne-light` | `#dcc394` | same | Champagne hover |
| | `champagne-ink` | `#7f5f2a` | `#d4b47e` | Champagne text on light |
| | `champagne-tint` | `#f3ead9` | `#231c10` | Signature badge ground |
| | `on-champagne` | `#141416` | same | Text on champagne |
| racing | `racing` | `#0f7a3f` | `#5fd394` | Savings, electric, success |
| | `green-tint` | `#e7f4ec` | `#0f2618` | Success / savings tint |
| amber | `amber` (utility `amber-ds`) | `#8a5a12` | `#e9b45a` | Warnings, "requested", balances owing |
| | `amber-tint` | `#f7eedd` | `#2a1f0c` | Warning tint |
| steel | `steel` | `#2f5b8a` | `#93b6dd` | Info, focus ring, charts |
| | `steel-tint` | `#e8eef5` | `#111d2b` | Info tint |
| scrim | `scrim` | `rgba(14,14,16,.52)` | `rgba(0,0,0,.66)` | Dialog overlay |

### 4.2 Semantic (shadcn) mapping

| Semantic | Maps to |
| :--- | :--- |
| `background` / `foreground` | `surface-page` / `ink` |
| `card`, `popover` | `surface-sheet` |
| `primary` / `primary-foreground` | `brand` / `on-brand` |
| `secondary`, `muted`, `accent` | `surface-sunken` |
| `muted-foreground` | `ink-muted` |
| `destructive` | `brand` |
| `success` / `warning` / `info` | `racing` / `amber` / `steel` |
| `border` / `input` / `ring` | `line` / `line-field` / `steel` |
| `sidebar*` (ERP) | sheet ground, ink text, sunken hover, red active icon |

### 4.3 Calendar / status colours (both themes)

| Token | Value | Text on it |
| :--- | :--- | :--- |
| `status-unassigned` | `#e9b45a` | `text-black/80` |
| `status-reservation` | `#2f5b8a` | white |
| `status-rental` | `#0f7a3f` | white |
| `status-oneway` | `#7f5f2a` | white |
| `status-overdue` | `#d0121b` | white |

### 4.4 The Signature wing

Wrap a section in `.signature` (defined in `public.css`) to re-map the semantic tokens:
- Ground: `onyx`
- Text: `on-onyx`
- Cards: `onyx-sheet`
- Primary: `champagne`

Components inside need no changes. Signature classes are detected by `categoryOf()` in `ds.tsx`: premium, luxury,
Range Rover, Audi, BMW, Mercedes (not the EQB), AMG, convertibles.

---

## 5. Shape, elevation, spacing, layout

| Token | Public | ERP | Utility |
| :--- | :--- | :--- | :--- |
| radius-control | 12px | 10px | `rounded-control` (also `rounded-lg`) |
| radius-card | 20px | 16px | `rounded-card` |
| radius-sheet | 28px | 22px | `rounded-sheet` |
| radius-pill | 999px | 999px | `rounded-pill` |
| control height | 44px | 36px | `h-(--control-height)` (default Button / Input / Select) |

| Shadow | Utility | Use |
| :--- | :--- | :--- |
| shadow-primary | `shadow-primary` | 1px base under buttons, the scrolled header |
| shadow-lift | `shadow-lift` | Card hover |
| shadow-booking | `shadow-booking` | The booking capsule (the one resting shadow) |
| shadow-floating | `shadow-floating` | Popovers, menus, dialogs, tooltips |

- **Spacing:** 4 · 8 · 12 · 16 · 24 · 32 · 56 · 96 (section).
- **Breakpoints:** 640 · 768 · 1024 · 1280.
- **Layout:** container max 1280px, header height 76px (`--header-height`).
- **Z-index:** header 40 · popover 50 · dialog 50.

---

## 6. Surfaces

### 6.1 Public site (`data-brand="public"`, light)

**Header** (`site-chrome.tsx`):
- 76px sheet, sticky, with a hairline and `shadow-primary` once scrolled.
- Left: the logo. Then nav links with the 2px red active underline.
- Right: the phone number (help is one tap away) and a pill "Log in / My account".
- Mobile: full-height menu sheet.

**Footer:** a sheet with four columns (brand + contact pills, Rent, Locations, Company) and a legal line. No watermark.

**Home** (`(public)/page.tsx`), top to bottom:
1. **Hero band:** `rounded-sheet` sheet with the blush glow top-right.
   - `type-hero` headline with the key phrase in red.
   - Lead, "from $X/day" from the lowest live rate, and the car.
2. **Booking capsule** overlapping the band (`BookingWidget variant="bar"`): a pill on desktop and a stacked sheet on
   mobile.
3. **Trust strip:** four facts with icon tiles.
4. **Price ladder:** `ClassTile` × 5.
5. **"Cars people book most":** category chips + `VehicleCard`s.
6. **Promo banners** (green / steel / sheet).
7. **Signature band:** onyx, serif display, champagne pill button, cars on ivory studio plates.
8. **Location cards.**
9. **Makes in our fleet** chips.

**Inner pages** start with `PageHero` (sheet band with kicker, `type-title-1` and lead), then content in `Container`.
Pages: Fleet, Locations, Contact, About, Services, Blog.

**Booking flow** (`/book`, `/book/options`, `/book/details`, `/book/confirmed`):
- `BookingSteps` stepper: ink for the current step, green check for done steps.
- The results show a wide `VehicleClassCard` with the daily `Price`, the est. all-in total underneath and the
  "Reserve" action.
- Protection and extras are selectable cards, with an ink ring when selected.
- `BookingSummary`: a trip and car card plus the price summary with a big total ("Taxes and fees included · CAD").
- Confirmation shows the number in `type-code`.

### 6.2 Staff ERP (`data-brand="erp"`, light + dark)

**Shell** (`shell/sidebar.tsx`):
- **Sidebar:** white sheet, 256px wide, collapsing to 72px.
  - Top: the logo + "ERP" code chip, the working-location switcher (field-style button) and an **ink** "New" button.
  - Nav uses Lucide icons, with group labels in sentence case.
  - Active item: sunken ground, semibold, red icon. There are no coloured bars.
  - Bottom: the user menu (Light / Dark / System and Sign out) and the collapse toggle.
- **Mobile:** a 56px top bar plus a drawer.

**Dark mode** is opt-in per user through the user menu (next-themes, `storageKey="mrac-erp-theme"`).

**`PageHeader`:** breadcrumbs, the page title (Inter Bold 26–28px) with an optional description, and actions
right-aligned. Only the main action is red.

**Dashboard:**
- KPI cards with label, icon tile and big tabular number.
- The fleet status strip is a 9-cell grid of hairline-separated sheets.
- Charts use `steel`, and green for "good".
- Segmented controls use `ink` for the selected segment.

**Lists:**
- `LegacySearchBar`: an outline "Advanced search" button, a search field and an **ink** "Search" button.
- Tables sit in a card with a muted header row in sentence case.
- Record numbers are red links.
- **Every record row is clickable** via `LinkRow` (`(erp)/_components/link-row.tsx`). Clicking anywhere opens the
  detail page. Buttons and links inside the row keep their own behaviour. Ctrl/Cmd/middle-click opens a new tab, and
  selecting text does not navigate.

**Login:** the centred logo, a "Staff sign in" title, a `rounded-sheet` card with `shadow-lift`, and a large red
"Sign in" button.

**Icons:**
- Navigation uses `lucide-react`.
- Operational glyphs from `/public/assest/Icons` are still available through `<ErpIcon name=… />`, which masks the SVG
  and paints it in `currentColor` so it follows the theme.

**Print:** printed documents use `.force-light` and `print-kit` (always paper-white). `erp.css` hides `[data-sidebar]`
and the header when printing.

---

## 7. Components

### 7.1 Shared (`@mrac/ui/components`)

| Component | Spec |
| :--- | :--- |
| **Button** | `rounded-control`, SemiBold, flat + `shadow-primary`, active nudge 1px, 2px steel focus ring offset 2px. Variants: `default` (red, one per view), `ink` (black, secondary emphasis), `outline`, `secondary`, `ghost`, `link`, `destructive`, `destructive-outline`, `signature` (champagne pill). Sizes: `default` (control height), `sm` 32px, `lg` 48px, `icon`, `icon-sm`. |
| **Input / Textarea / NativeSelect** | Share `fieldClass`: `rounded-control`, `border-input` (line-field), `bg-card`. Hover darkens the border; focus shows an ink border + 2px steel ring. `aria-invalid` turns it red. |
| **Label** | 13px semibold. |
| **Card** | `rounded-card`, 1px border, `bg-card`, no resting shadow; 20px padding. `CardTitle` is 15px semibold. |
| **Badge** | `rounded-pill`, tinted ground + strong text. `success`/`on-rent` green, `warning`/`pending` amber, `info`/`confirmed` steel, `destructive` blush/red, `overdue` solid red, `signature` champagne, `muted`/`closed` sunken. |
| **Table** | Muted header row (12px semibold, sentence case), card body, hairline rows, `hover:bg-muted/50`, tabular numbers. |
| **Tabs** | Underline tabs; the active tab gets a 2px red underline. |
| **Dialog / AlertDialog** | `rounded-sheet`, `bg-card`, `shadow-floating`, `bg-scrim` overlay with a slight blur, pill close button. |
| **DropdownMenu / Popover / Tooltip** | `shadow-floating`. Menus use radius-control + 4px with items at radius-control − 4px; popovers `rounded-card`; tooltips are ink with light text. |
| **BrandLogo** | `public/legacy/logo.webp` (colour). `variant="white"` / dark mode uses `mrac-white-logo.png`. Size with a height class: header `h-8 sm:h-9`, sidebar `h-7`, login `h-11`. `BrandMark` = the car badge alone (collapsed sidebar). |

### 7.2 Public building blocks (`(public)/_components`)

| Component | File | Spec |
| :--- | :--- | :--- |
| `Price` | `ds.tsx` | Inter 800, tabular, raised "$", "/day" muted; `from` prefix; sizes `sm` / `md` / `lg`. |
| `SectionHeading` | `ds.tsx` | Red kicker (champagne in Signature), `type-title-2` (serif in Signature), lead, optional action. |
| `ArrowLink` | `ds.tsx` | Semibold link with an arrow that nudges 3px. |
| `PageHero` | `ds.tsx` | Inner-page band: sheet, `rounded-sheet`, blush corner, kicker + `type-title-1` + lead. |
| `Container` | `ds.tsx` | 1280px, 16px / 32px gutters. |
| `ClassTile` | `ds.tsx` | Category, studio photo, class count, "from $X/day". The Signature tile switches to onyx + serif. |
| `VehicleCard` | `ds.tsx` | Studio photo 16:10, title, "or similar" line, `Specs`, footer with price + action. Signature cards are onyx with a champagne badge. |
| `VehicleClassCard` | `vehicle-class-card.tsx` | Wide results row: photo left, specs, price and action right. |
| `PromoBanner` | `ds.tsx` | `rounded-card`; tones `sheet` / `green` / `steel`; icon tile, title, one line, arrow CTA. |
| `Notice` | `ds.tsx` | Tinted message with icon; tones `info` / `success` / `warning` / `danger` / `muted`. |
| `LocationCard` | `location-card.tsx` | Icon tile (plane for airports), name + `type-code` airport code, one-line address + city line, hours, key-drop note, phone pill, "Get directions". |
| `BookingWidget` | `booking-widget.tsx` | `bar`: pill capsule (desktop) / stacked sheet (mobile) with cells for Pick-up · (Return) · Pick-up date+time · Return date+time · red "Find a car"; "Return to a different location" toggle reveals the Return cell; promo code behind "Add a promo code". `compact`: same in a card ("Update"). `panel`: stacked fields on a card. |
| `ListPicker` | `pickers.tsx` | Themed dropdown (replaces the browser's `<select>` menu): popover listbox, keyboard (↑ ↓ Home End Enter Esc), optional search (auto when > 8 locations), group headings, icon tiles, selected = ink tile + red check. Variants: `bare` (inside a capsule cell) and `field` (input-styled). |
| `locationOptions()` | `pickers.tsx` | Short label ("Burnaby", "Vancouver Airport"), sub-line (street / "Off-airport pick-up"), YVR/YYC code, grouped "Metro Vancouver" / "Calgary", airports first. |

---

## 8. Using the system — checklist for new UI

- **Colours:** use token utilities only. If a colour is missing, add a token to `globals.css` (light **and** dark) and
  a `--color-*` mapping in `@theme inline`.
- **Fonts:** never import fonts in a page. They come from `_fonts/fonts.ts` via the root layouts.
- **Buttons:** one red button per view. Use `ink` for the next-most-important action and `outline` / `ghost` for the
  rest.
- **Dropdowns:** on the public site, use `ListPicker`, not a bare `<select>`. In dense ERP forms `NativeSelect` is
  fine.
- **Record lists in the ERP:** wrap each row in `LinkRow` with the detail `href`.
- **Signature content:** wrap it in `.signature`. Use `font-serif` / `type-signature-*` only there.
- **Text style:** sentence case, no exclamation marks, numbers over adjectives, and name every fee.
- **Before shipping:** check light and dark (ERP), a 390px viewport, keyboard focus, and contrast.
