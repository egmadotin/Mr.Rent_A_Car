# Mr Rent A Car ERP — Design System & UI Specification (`design.md`)

> **Master UI/UX Blueprint for Rebuilding the Mr Rent A Car Fleet & Rental ERP**  
> *Target Stack: Next.js 15 (Turborepo) · Tailwind CSS v4 · `@mrac/ui` · Custom Assets (`/assest/`)*

---

## Executive Summary & Design Vision

This design system transforms the Mr Rent A Car ERP from a dated utilitarian portal into a **prestigious, editorial-grade luxury automotive workstation**. The aesthetic couples the warmth and authority of heritage print publishing with the surgical precision and information density demanded by high-velocity fleet operations.

### Core Visual Tenets
1. **Warm Natural Canvas (`#E9E3D5`)**: Replaces cold sterile grays with a rich, tactile, parchment-toned neutral that reduces eye fatigue across 10-hour rental counter shifts.
2. **Authoritative Terra Red (`#9D302D`)**: Drives primary workflows, high-value contracts, and primary calls to action with deliberate confidence.
3. **Operational Forest Moss (`#3B511F`)**: Designates positive operational states—vehicle ready, inspection passed, booking confirmed, active on-rent status.
4. **Carbon Slate Foundation (`#2D2C2C`)**: Anchor for high-contrast dark sidebars, data-dense table typography, and crisp borders.
5. **Dual Editorial & High-Legibility Typography**: Pairing **Libre Baskerville** for branded prestige with **Helvetica Now Display** for condensed, razor-sharp numerical and operational clarity.
6. **Bespoke Texture & Iconography**: Integrating the custom geometric background (`pattern bg.png`) and custom SVG operational iconography suite located in `/apps/web/public/assest/`.

---

## 1. Typography

The design system incorporates a dual-typeface strategy pairing a classic editorial serif for prominence and hierarchy with a contemporary neo-grotesque sans-serif for high-legibility UI operations and data density.

| Font Family | Usage | Weights / Styles |
| :--- | :--- | :--- |
| **Libre Baskerville** | Brand headers, modal titles, page hero headings, metric highlights, key report summaries, printable contracts | • **Bold** (`font-bold` / `700`)<br>• **Regular** (`font-normal` / `400`)<br>• **Italic** (`italic` / `400`) |
| **Helvetica Now Display** | Primary UI text, buttons, navigation links, table data, forms, labels, status badges, dense numeric metrics | • **Light** (`font-light` / `300`)<br>• **Regular** (`font-normal` / `400`)<br>• **Medium** (`font-medium` / `500`)<br>• **Bold** (`font-bold` / `700`)<br>• **Black / Extra Bold** (`font-extrabold` / `900`) |

### Font Stacks & Fallbacks
```css
--font-serif: 'Libre Baskerville', Georgia, 'Times New Roman', serif;
--font-sans: 'Helvetica Now Display', 'Helvetica Neue', Helvetica, Arial, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace;
```

### Next.js 15 Font Configuration (`apps/web/app/(erp)/layout.tsx`)
```tsx
import { Libre_Baskerville } from "next/font/google";
import localFont from "next/font/local";

export const libreBaskerville = Libre_Baskerville({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const helveticaNow = localFont({
  src: [
    { path: "../../../public/fonts/HelveticaNowDisplay-Light.woff2", weight: "300", style: "normal" },
    { path: "../../../public/fonts/HelveticaNowDisplay-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../../public/fonts/HelveticaNowDisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../../public/fonts/HelveticaNowDisplay-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../../public/fonts/HelveticaNowDisplay-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-sans",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
  display: "swap",
});
```

### Typography Scale & Hierarchy
| Token | Size | Line Height | Tracking | Recommended Usage |
| :--- | :--- | :--- | :--- | :--- |
| `display-1` | `2.5rem` (40px) | `1.15` | `-0.02em` | Main dashboard welcome hero, major daily financial totals (Libre Baskerville Bold) |
| `h1` | `2.0rem` (32px) | `1.2` | `-0.015em` | Page headers, rental agreement top headers, vehicle inspection titles |
| `h2` | `1.5rem` (24px) | `1.25` | `-0.01em` | Section headers, card group titles, modal headlines (Libre Baskerville Regular) |
| `h3` | `1.1875rem` (19px) | `1.3` | `0` | Sub-sections, customer profile banners, fleet grouping headers |
| `body-lg` | `1.0rem` (16px) | `1.5` | `0` | Key narrative copy, modal body text, primary button labels |
| `body-base` | `0.875rem` (14px) | `1.4` | `0` | Default ERP UI: form inputs, table cell records, tabs, dropdowns |
| `body-sm` | `0.75rem` (12px) | `1.35` | `+0.01em` | Table secondary subtext, metadata labels, status chips, timestamps |
| `caption` | `0.6875rem` (11px) | `1.25` | `+0.02em` | Uppercase table column headers, badge counters, micro audit logs |

---

## 2. Color System & Palettes

All colors are arranged in structured tint/shade ramps from `100` (deepest / most saturated) down to `10` (lightest tint).

### 2.1. Primary & Core Roles

| Token Name | Hex Code | Visual Swatch | Semantic Mapping |
| :--- | :--- | :--- | :--- |
| **Primary** | `#9D302D` | `rgb(157, 48, 45)` | Core brand actions, primary CTAs, active highlights (Terra Red 100) |
| **Primary 2** | `#3B511F` | `rgb(59, 81, 31)` | Secondary brand accent, success/positive indicators (Forest Moss 100) |
| **Background** | `#E9E3D5` | `rgb(233, 227, 213)` | Soft warm neutral canvas / page background |
| **Golden Ember** | `#F1B826` | `rgb(241, 184, 38)` | Attention highlights, warnings, pending states (Yellow 100) |
| **Carbon Slate** | `#2D2C2C` | `rgb(45, 44, 44)` | Dark contrast surfaces, primary text, rich dark sidebar (Carbon 100) |
| **Color (White / Surface)** | `#FFFFFF` | `rgb(255, 255, 255)` | Pure cards, modals, dropdown containers, high contrast text |

---

### 2.2. Terra Red Palette (Brand Primary)

| Token Name | Hex Code | Preview | Recommended Usage |
| :--- | :--- | :--- | :--- |
| `terra-red-100` | `#9D302D` | `rgb(157, 48, 45)` | Primary buttons, active tabs, major brand elements, contract signatures |
| `terra-red-80` | `#B15957` | `rgb(177, 89, 87)` | Hover state for primary buttons, active sidebar item backdrop |
| `terra-red-60` | `#C48381` | `rgb(196, 131, 129)` | Badges, secondary emphasis outlines, urgent return flags |
| `terra-red-40` | `#D8ACAB` | `rgb(216, 172, 171)` | Subtle borders, light chip borders, focus rings |
| `terra-red-20` | `#EBD6D5` | `rgb(235, 214, 213)` | Light alert / notification backgrounds, selected row tint |
| `terra-red-10` | `#F6EBEA` | `rgb(246, 235, 234)` | Subtle table row highlights, pill backgrounds, tab indicator bar |

---

### 2.3. Forest Moss Palette (Secondary Brand & Success)

| Token Name | Hex Code | Preview | Recommended Usage |
| :--- | :--- | :--- | :--- |
| `forest-moss-100`| `#3B511F` | `rgb(59, 81, 31)` | Success CTAs, approved tags, inventory confirmed, vehicle available |
| `forest-moss-80` | `#62744C` | `rgb(98, 116, 76)` | Secondary positive actions, hover states for check-in / approval |
| `forest-moss-60` | `#899779` | `rgb(137, 151, 121)` | Badges, graphs, secondary data series, fuel full indicators |
| `forest-moss-40` | `#B1B9A5` | `rgb(177, 185, 165)` | Inactive success toggles, light dividers, inspection checkboxes |
| `forest-moss-20` | `#D8DCD2` | `rgb(216, 220, 210)` | Success pill backgrounds, soft card fill, paid invoice badge fill |
| `forest-moss-10` | `#ECEEE9` | `rgb(236, 238, 233)` | Table row highlights, subtle badge surface, verified customer chip |

---

### 2.4. Yellow / Golden Ember Palette (Warning & Highlights)

| Token Name | Hex Code | Preview | Recommended Usage |
| :--- | :--- | :--- | :--- |
| `yellow-100` | `#F1B826` | `rgb(241, 184, 38)` | Pending status, attention icons, notification badges, quotes expiring |
| `yellow-80` | `#F4C651` | `rgb(244, 198, 81)` | Hover for warning actions, charts, payment awaiting auth |
| `yellow-60` | `#F7D47D` | `rgb(247, 212, 125)` | Light warning chips, focus rings, security deposit hold banner |
| `yellow-40` | `#F9E3A8` | `rgb(249, 227, 168)` | Warning borders, soft accents, maintenance alert borders |
| `yellow-20` | `#FCF1D4` | `rgb(252, 241, 212)` | Warning background alerts, toast backgrounds, pending quote pill |
| `yellow-10` | `#FEF8EA` | `rgb(254, 248, 234)` | Subtle pending row indicators, tag backgrounds, reservation highlight |

---

### 2.5. Carbon Palette (Neutrals, Text, & Dark UI)

| Token Name | Hex Code | Preview | Recommended Usage |
| :--- | :--- | :--- | :--- |
| `carbon-100` | `#2D2C2C` | `rgb(45, 44, 44)` | Dark sidebars, primary typography, high-contrast buttons, card headers |
| `carbon-80` | `#575656` | `rgb(87, 86, 86)` | Secondary text, inactive tab headers, subtext, VIN codes |
| `carbon-60` | `#818080` | `rgb(129, 128, 128)` | Placeholder text, helper text, neutral icons, table borders |
| `carbon-40` | `#ABABAB` | `rgb(171, 171, 171)` | Input borders, card dividers, inactive pagination buttons |
| `carbon-20` | `#D5D5D5` | `rgb(213, 213, 213)` | Subtle table borders, inactive background toggles, modal outlines |
| `carbon-10` | `#EAEAEA` | `rgb(234, 234, 234)` | Light neutral fill, disabled input background, zebra row striping |

---

## 3. Asset Directory Structure & Catalog

All project UI assets are located in `apps/web/public/assest/` (referenced directly in Next.js via absolute web paths `/assest/...`).

```
apps/web/public/assest/
├── pattern bg.png                     # Master luxury editorial background texture (414 KB)
└── Icons/                             # Custom ERP SVG operational icon suite
    ├── Add-1.svg                      # Plus variant (compact)
    ├── Add.svg                        # Primary Add / Create record action
    ├── Bank.svg                       # Bank / Direct deposit / Accounts
    ├── Bounced.svg                    # NSF / Declined payment / Bounced cheque
    ├── Change Order.svg               # Rate amendment / Contract change order
    ├── Cheque.svg                     # Physical cheque payment recording
    ├── Comapny.svg                    # Corporate accounts & B2B fleet clients
    ├── Customer.svg                   # Single customer profile / driver
    ├── Customers.svg                  # Customer directory / CRM database
    ├── Delete.svg                     # Destructive delete / Remove item
    ├── Dollar.svg                     # Cash / Currency / Transaction total
    ├── Draft.svg                      # Draft quote / Unfinalized contract
    ├── Icon.svg                       # General multipurpose operational badge
    ├── List-1.svg                     # Compact list toggle
    ├── List.svg                       # Fleet table / Data ledger view
    ├── Print.svg                      # Print Rental Agreement / Invoice / Receipt
    ├── Routes.svg                     # Vehicle routing / Pickup-dropoff transfers
    ├── Tick.svg                       # Verified badge / Checkmark confirmation
    ├── Truck.svg                      # Commercial vehicle / Transport / Fleet class
    ├── Vector.svg                     # Geometric brand mark accent
    ├── View.svg                       # View record / Preview contract modal
    ├── approve.svg                    # Verification passed / Reservation approved
    ├── bag-1.svg                      # Luggage item / Single baggage add-on
    ├── bag.svg                        # Accessories package (GPS, booster seat)
    ├── collection.svg                 # Cash drawer / Payment collection ledger
    ├── cross-1.svg                    # Dismiss modal / Mini close
    ├── cross.svg                      # Reject action / Cancel reservation
    ├── deactivate.svg                 # Inactive vehicle / Grounded fleet status
    ├── download.svg                   # Export CSV / Download signed PDF
    ├── edit.svg                       # Edit contract / Modify customer profile
    ├── location.svg                   # Branch / Airport depot (Richmond, YVR, YYC)
    ├── lock.svg                       # Locked rate / Security clearance / Admin
    ├── pending.svg                    # Pending confirmation / Clock status
    ├── record paymnt.svg              # Terminal payment / Settle balance action
    ├── refresh.svg                    # Sync legacy RentCentric / Refresh grid
    ├── reject.svg                     # Declined reservation / Void agreement
    ├── save.svg                       # Save progress / Commit changes
    ├── shapes.svg                     # Fleet category / Class groupings
    ├── stock-dark.svg                 # Inventory count badge (Dark surface)
    ├── stock.svg                      # Inventory count badge (Light surface)
    ├── todays collection.svg          # Daily financial closeout / Cashier tally
    ├── toggle.svg                     # Quick status switcher
    ├── upload icon.svg                # Upload driver licence / Insurance scan
    ├── bill/
    │   └── invoice.svg                # Customer billing folio / Tax invoice
    └── box/
        └── order.svg                  # Equipment package / Work order
```

### 3.1. Pattern Background (`pattern bg.png`) Implementation Guide

The `pattern bg.png` file is a high-resolution, repeating geometric brand texture engineered to provide depth and luxury character across ERP surfaces.

#### Use Cases:
1. **Collapsible Left Sidebar Backdrop**: Applied to the dark `#2D2C2C` sidebar container with a low-opacity overlay (`opacity-15`) to create a bespoke, tailor-made executive panel.
2. **Page Hero & Summary Banners**: Used behind top metric banners (e.g., Fleet Utilization, Today's Gross Revenue) for visual punch.
3. **Modal & Drawer Headers**: Applied across the top 64px of high-importance dialogs (Rental Check-Out, Payment Capture).
4. **Printout Document Letterhead**: Rendered as a watermark header banner on printable Rental Agreements and Invoices.

#### Reusable CSS Classes (add to `erp.css` or Tailwind):
```css
/* Sidebar Dark Pattern */
.bg-erp-sidebar-pattern {
  background-color: #2D2C2C;
  background-image: linear-gradient(rgba(45, 44, 44, 0.88), rgba(45, 44, 44, 0.94)),
                    url('/assest/pattern bg.png');
  background-repeat: repeat;
  background-size: 320px auto;
}

/* Hero Warm Brand Header Pattern */
.bg-erp-hero-pattern {
  background-color: #9D302D;
  background-image: linear-gradient(135deg, rgba(157, 48, 45, 0.92) 0%, rgba(120, 36, 34, 0.96) 100%),
                    url('/assest/pattern bg.png');
  background-repeat: repeat;
  background-size: 280px auto;
}

/* Subtle Canvas Watermark */
.bg-erp-watermark-pattern {
  background-color: #E9E3D5;
  background-image: linear-gradient(rgba(233, 227, 213, 0.94), rgba(233, 227, 213, 0.97)),
                    url('/assest/pattern bg.png');
  background-repeat: repeat;
  background-size: 360px auto;
}
```

---

### 3.2. SVG Icons Semantic Mapping & Matrix

| SVG Filename | Dimensions | Theme Color | Semantic ERP Action / Component |
| :--- | :--- | :--- | :--- |
| `Add.svg` | 24×24 | `#E9E3D5` / White | Primary header button: "New Reservation", "Add Vehicle", "Create Quote" |
| `Bank.svg` | 27×30 | `#E9E3D5` | Payment Drawer: Direct Debit, Wire Transfer, Corporate Billing Account |
| `Bounced.svg` | 20×20 | `#2D2C2C` / Dark | Alerts: Bounced cheque, chargeback alert, payment declined badge |
| `Change Order.svg` | 24×24 | Multi | Rental Contract: Extension, vehicle swap, rate adjustment modal |
| `Cheque.svg` | 24×24 | Dark | Billing: Physical cheque payment modal, cheque number entry |
| `Comapny.svg` | 24×24 | `#E9E3D5` | Corporate Accounts: Company billing profile, B2B insurance profile |
| `Customer.svg` | 24×24 | Neutral | Single customer record, primary driver assignment |
| `Customers.svg` | 24×24 | Neutral | CRM customer directory tab, driver search dialog |
| `Delete.svg` | 24×24 | Neutral | Destructive actions: Void line item, cancel draft, delete note |
| `Dollar.svg` | 24×24 | Neutral | Financial KPIs: Total revenue, mandatory deposits, ancillary charges |
| `Draft.svg` | 24×24 | Neutral | Status pill: Draft quotes, unconfirmed reservations, pending RA |
| `List.svg` | 24×24 | Neutral | Fleet table view, reservation roster, audit log table |
| `Print.svg` | 24×24 | Neutral | Top bar utility: Print RA (Rental Agreement), print invoice folio |
| `Routes.svg` | 24×24 | Neutral | Logistics: One-way rentals, airport shuttle transfers, branch routing |
| `Tick.svg` | 24×24 | Forest Moss | Verification: Driver licence verified, credit card authorized |
| `Truck.svg` | 24×24 | Neutral | Commercial Fleet: Cargo vans, trucks, high-occupancy 12-passenger vans |
| `View.svg` | 24×24 | Neutral | Table action: Open detailed inspection dialog, preview contract PDF |
| `approve.svg` | 26×26 | `#3B511F` (Forest) | Approval button / badge: Approve quote, confirm check-in inspection |
| `bag.svg` / `bag-1.svg` | 24×24 | Neutral | Ancillary add-ons: Additional luggage, child safety seats, ski racks |
| `bill/invoice.svg` | 24×24 | Neutral | Financials: Generate final folio invoice, tax breakdown dialog |
| `box/order.svg` | 24×24 | Neutral | Fleet maintenance: Parts order, repair slip, supply request |
| `collection.svg` | 24×24 | Neutral | Cashier: Daily shift collections, POS terminal balance report |
| `cross.svg` | 24×24 | Neutral | Rejection: Cancel rental, void contract, reject insurance waiver |
| `deactivate.svg` | 24×24 | Neutral | Fleet maintenance: Ground vehicle, mark "Out of Service", lock account |
| `download.svg` | 24×24 | Neutral | Export: Download Excel fleet roster, download PDF agreement |
| `edit.svg` | 24×24 | Neutral | Actions: Edit customer, modify rental rates, change assigned vehicle |
| `location.svg` | 24×24 | Neutral | Branch switcher: Richmond, Vancouver Admin, YVR, YYC, Surrey |
| `lock.svg` | 24×24 | Neutral | Security: Closed accounting period, immutable signed agreement |
| `pending.svg` | 20×20 | `#E9E3D5` | Badges: Awaiting customer signature, pending payment verification |
| `record paymnt.svg`| 24×24 | Neutral | Primary action: Record payment, charge credit card, pre-auth hold |
| `refresh.svg` | 24×24 | Neutral | Table header: Sync with live RentCentric API / database refresh |
| `reject.svg` | 24×24 | Carbon / Red | Status / Button: Decline reservation, flag blacklisted customer |
| `save.svg` | 24×24 | Neutral | Form footer: Save draft, update vehicle specs, commit check-in |
| `stock.svg` / `stock-dark.svg` | 25×20 | `#E9E3D5` / `#2D2C2C` | Fleet status: Available vehicles in stock / inventory count |
| `todays collection.svg` | 33×24 | `#E9E3D5` | Financial header: Today's cashier collection summary card |
| `upload icon.svg`| 24×24 | Neutral | Customer intake: Upload driver's licence front/back, insurance binder |

#### Universal React Icon Helper Component
To guarantee clean rendering, accessibility, and color inheritance:

```tsx
// packages/ui/src/components/erp-icon.tsx
import * as React from "react";
import Image from "next/image";
import { cn } from "../lib/utils";

export type ErpIconName =
  | "add" | "bank" | "bounced" | "change-order" | "cheque"
  | "company" | "customer" | "customers" | "delete" | "dollar"
  | "draft" | "list" | "print" | "routes" | "tick" | "truck"
  | "view" | "approve" | "bag" | "collection" | "cross"
  | "deactivate" | "download" | "edit" | "location" | "lock"
  | "pending" | "record-payment" | "refresh" | "reject" | "save"
  | "stock" | "stock-dark" | "todays-collection" | "upload"
  | "invoice" | "order";

const ICON_PATHS: Record<ErpIconName, string> = {
  "add": "/assest/Icons/Add.svg",
  "bank": "/assest/Icons/Bank.svg",
  "bounced": "/assest/Icons/Bounced.svg",
  "change-order": "/assest/Icons/Change Order.svg",
  "cheque": "/assest/Icons/Cheque.svg",
  "company": "/assest/Icons/Comapny.svg",
  "customer": "/assest/Icons/Customer.svg",
  "customers": "/assest/Icons/Customers.svg",
  "delete": "/assest/Icons/Delete.svg",
  "dollar": "/assest/Icons/Dollar.svg",
  "draft": "/assest/Icons/Draft.svg",
  "list": "/assest/Icons/List.svg",
  "print": "/assest/Icons/Print.svg",
  "routes": "/assest/Icons/Routes.svg",
  "tick": "/assest/Icons/Tick.svg",
  "truck": "/assest/Icons/Truck.svg",
  "view": "/assest/Icons/View.svg",
  "approve": "/assest/Icons/approve.svg",
  "bag": "/assest/Icons/bag.svg",
  "collection": "/assest/Icons/collection.svg",
  "cross": "/assest/Icons/cross.svg",
  "deactivate": "/assest/Icons/deactivate.svg",
  "download": "/assest/Icons/download.svg",
  "edit": "/assest/Icons/edit.svg",
  "location": "/assest/Icons/location.svg",
  "lock": "/assest/Icons/lock.svg",
  "pending": "/assest/Icons/pending.svg",
  "record-payment": "/assest/Icons/record paymnt.svg",
  "refresh": "/assest/Icons/refresh.svg",
  "reject": "/assest/Icons/reject.svg",
  "save": "/assest/Icons/save.svg",
  "stock": "/assest/Icons/stock.svg",
  "stock-dark": "/assest/Icons/stock-dark.svg",
  "todays-collection": "/assest/Icons/todays collection.svg",
  "upload": "/assest/Icons/upload icon.svg",
  "invoice": "/assest/Icons/bill/invoice.svg",
  "order": "/assest/Icons/box/order.svg",
};

interface ErpIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: ErpIconName;
  size?: number;
  className?: string;
  alt?: string;
}

export function ErpIcon({ name, size = 18, className, alt = "", ...props }: ErpIconProps) {
  const path = ICON_PATHS[name];
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0 select-none", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <Image
        src={path}
        alt={alt}
        width={size}
        height={size}
        className="w-full h-full object-contain"
        unoptimized
      />
    </span>
  );
}
```

---

## 4. CSS Variables / Design Tokens Implementation

Add these tokens directly into `packages/ui/src/styles/globals.css` and `apps/web/app/(erp)/erp.css`.

```css
/* ==========================================================================
   Mr Rent A Car — Design Tokens & CSS Variables
   ========================================================================== */

:root {
  /* Fonts */
  --font-serif: "Libre Baskerville", Georgia, serif;
  --font-sans: "Helvetica Now Display", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-mono: "JetBrains Mono", Menlo, Consolas, monospace;

  /* Theme Core Brand Tokens */
  --color-primary: #9D302D;
  --color-primary-2: #3B511F;
  --color-bg-main: #E9E3D5;
  --color-golden-ember: #F1B826;
  --color-carbon-slate: #2D2C2C;
  --color-surface-white: #FFFFFF;

  /* Terra Red Scale (Brand Primary) */
  --terra-red-100: #9D302D;
  --terra-red-80: #B15957;
  --terra-red-60: #C48381;
  --terra-red-40: #D8ACAB;
  --terra-red-20: #EBD6D5;
  --terra-red-10: #F6EBEA;

  /* Forest Moss Scale (Secondary & Operational Success) */
  --forest-moss-100: #3B511F;
  --forest-moss-80: #62744C;
  --forest-moss-60: #899779;
  --forest-moss-40: #B1B9A5;
  --forest-moss-20: #D8DCD2;
  --forest-moss-10: #ECEEE9;

  /* Yellow / Golden Ember Scale (Warnings & Pending) */
  --yellow-100: #F1B826;
  --yellow-80: #F4C651;
  --yellow-60: #F7D47D;
  --yellow-40: #F9E3A8;
  --yellow-20: #FCF1D4;
  --yellow-10: #FEF8EA;

  /* Carbon Slate Scale (Neutrals, Surfaces & High-Contrast Text) */
  --carbon-100: #2D2C2C;
  --carbon-80: #575656;
  --carbon-60: #818080;
  --carbon-40: #ABABAB;
  --carbon-20: #D5D5D5;
  --carbon-10: #EAEAEA;

  /* Semantic UI Dimensions */
  --radius-xs: 0.25rem;    /* 4px - chips, compact tags */
  --radius-sm: 0.375rem;   /* 6px - buttons, inputs, dropdown items */
  --radius-md: 0.5rem;     /* 8px - cards, dialogs, inspection cards */
  --radius-lg: 0.75rem;    /* 12px - major modals, hero panels */
  --radius-full: 9999px;   /* status pills, circular avatars */

  /* Elevation Shadows (Tailored to warm #E9E3D5 background) */
  --shadow-subtle: 0 1px 2px 0 rgba(45, 44, 44, 0.05);
  --shadow-card: 0 1px 3px 0 rgba(45, 44, 44, 0.08), 0 1px 2px -1px rgba(45, 44, 44, 0.08);
  --shadow-dropdown: 0 4px 6px -1px rgba(45, 44, 44, 0.12), 0 2px 4px -2px rgba(45, 44, 44, 0.08);
  --shadow-modal: 0 20px 25px -5px rgba(45, 44, 44, 0.2), 0 8px 10px -6px rgba(45, 44, 44, 0.15);
}

/* ── Staff ERP Brand Scope: [data-brand="erp"] ─────────────────────────── */
[data-brand="erp"] {
  --radius: 0.375rem;
  
  /* Canvas & Containers */
  --background: #E9E3D5;
  --foreground: #2D2C2C;
  
  --card: #FFFFFF;
  --card-foreground: #2D2C2C;
  
  --popover: #FFFFFF;
  --popover-foreground: #2D2C2C;

  /* Interactive States */
  --primary: #9D302D;
  --primary-foreground: #FFFFFF;
  
  --secondary: #ECEEE9;
  --secondary-foreground: #3B511F;
  
  --muted: #D5D5D5;
  --muted-foreground: #575656;
  
  --accent: #F6EBEA;
  --accent-foreground: #9D302D;
  
  --destructive: #9D302D;
  --destructive-foreground: #FFFFFF;

  --success: #3B511F;
  --success-foreground: #FFFFFF;

  --warning: #F1B826;
  --warning-foreground: #2D2C2C;

  --border: #D5D5D5;
  --input: #ABABAB;
  --ring: #9D302D;

  /* Executive Dark Sidebar */
  --sidebar: #2D2C2C;
  --sidebar-foreground: #E9E3D5;
  --sidebar-primary: #9D302D;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #3B511F;
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: rgba(233, 227, 213, 0.12);
  --sidebar-ring: #F1B826;

  /* Visual Calendar Booking Status Colors */
  --status-unassigned: #F1B826;   /* Golden Ember (Yellow 100) */
  --status-reservation: #B15957;  /* Terra Red 80 */
  --status-rental: #3B511F;       /* Forest Moss 100 */
  --status-oneway: #899779;       /* Forest Moss 60 */
  --status-overdue: #9D302D;      /* Urgent Terra Red 100 */
}
```

---

## 5. Tailwind Configuration Extension

### 5.1. Tailwind CSS v4 Theme Integration (`apps/web/app/(erp)/erp.css`)

Since the repository is built on Next.js 15 + Tailwind CSS v4 (`@tailwindcss/postcss: ^4`), use the `@theme` directive:

```css
@import "@mrac/ui/globals.css";

@theme inline {
  --font-serif: var(--font-serif), "Libre Baskerville", Georgia, serif;
  --font-sans: var(--font-sans), "Helvetica Now Display", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-mono: var(--font-mono), "JetBrains Mono", Menlo, Consolas, monospace;

  /* Core Palette */
  --color-kawa-bg: #E9E3D5;
  --color-kawa-primary: #9D302D;
  --color-kawa-primary2: #3B511F;
  --color-kawa-ember: #F1B826;
  --color-kawa-carbon: #2D2C2C;

  /* Terra Red */
  --color-terra-100: #9D302D;
  --color-terra-80: #B15957;
  --color-terra-60: #C48381;
  --color-terra-40: #D8ACAB;
  --color-terra-20: #EBD6D5;
  --color-terra-10: #F6EBEA;

  /* Forest Moss */
  --color-forest-100: #3B511F;
  --color-forest-80: #62744C;
  --color-forest-60: #899779;
  --color-forest-40: #B1B9A5;
  --color-forest-20: #D8DCD2;
  --color-forest-10: #ECEEE9;

  /* Yellow / Golden Ember */
  --color-yellow-100: #F1B826;
  --color-yellow-80: #F4C651;
  --color-yellow-60: #F7D47D;
  --color-yellow-40: #F9E3A8;
  --color-yellow-20: #FCF1D4;
  --color-yellow-10: #FEF8EA;

  /* Carbon Slate */
  --color-carbon-100: #2D2C2C;
  --color-carbon-80: #575656;
  --color-carbon-60: #818080;
  --color-carbon-40: #ABABAB;
  --color-carbon-20: #D5D5D5;
  --color-carbon-10: #EAEAEA;
}
```

### 5.2. Standard Tailwind v3 Compatible Config (`tailwind.config.js`)

For tooltips, storybook, or IDE autocomplete compatibility:

```js
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["var(--font-serif)", "Libre Baskerville", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Helvetica Now Display", "Helvetica", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      colors: {
        kawa: {
          bg: "#E9E3D5",
          primary: "#9D302D",
          primary2: "#3B511F",
          ember: "#F1B826",
          carbon: "#2D2C2C",
        },
        terra: {
          100: "#9D302D",
          80: "#B15957",
          60: "#C48381",
          40: "#D8ACAB",
          20: "#EBD6D5",
          10: "#F6EBEA",
        },
        forest: {
          100: "#3B511F",
          80: "#62744C",
          60: "#899779",
          40: "#B1B9A5",
          20: "#D8DCD2",
          10: "#ECEEE9",
        },
        yellow: {
          100: "#F1B826",
          80: "#F4C651",
          60: "#F7D47D",
          40: "#F9E3A8",
          20: "#FCF1D4",
          10: "#FEF8EA",
        },
        carbon: {
          100: "#2D2C2C",
          80: "#575656",
          60: "#818080",
          40: "#ABABAB",
          20: "#D5D5D5",
          10: "#EAEAEA",
        },
      },
      borderRadius: {
        xs: "0.25rem",
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
      },
    },
  },
};
```

---

## 6. ERP Core Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. TOP HEADER / APP BAR                                                      │
│ [Brand Mark] [Location Switcher: Richmond ▼]  [Today's Cash: $8,420] [Staff]│
├──────────────┬──────────────────────────────────────────────────────────────┤
│ 2. SIDEBAR   │ 3. MAIN WORKSPACE CANVAS (Background: #E9E3D5)               │
│ (Carbon Slate│                                                              │
│  + Pattern)  │ ┌──────────────────────────────────────────────────────────┐ │
│              │ │ Page Header (Libre Baskerville Bold) + Quick Actions     │ │
│ • Dashboard  │ ├──────────────────────────────────────────────────────────┤ │
│ • Quotes     │ │ KPI Summary Cards (Pure White Cards, Carbon-20 Border)   │ │
│ • Reservation│ ├──────────────────────────────────────────────────────────┤ │
│ • Rentals    │ │ Operational Data Tables / Fleet Matrix (Dense 36px rows) │ │
│ • Calendar   │ └──────────────────────────────────────────────────────────┘ │
│ • Vehicles   │                                                              │
│ • Customers  │ ┌──────────────────────────────────────────────────────────┐ │
│ • Reports    │ │ Slide-Over Drawer / Inspection Dialogs (White Surface)   │ │
│ • Settings   │ └──────────────────────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

### 6.1. Left Sidebar Specifications
- **Background**: Carbon Slate (`#2D2C2C`) paired with `.bg-erp-sidebar-pattern` (subtle repeating texture overlay).
- **Widths**: Expanded `240px` (`w-60`), Collapsed `68px` (`w-[68px]`).
- **Brand Header**:
  - Displays Mr Rent A Car logo in warm neutral `#E9E3D5`.
  - Sub-label in `caption` font: "FLEET MANAGEMENT ERP".
- **Navigation Items**:
  - Regular State: Text in `carbon-20` (`#D5D5D5`), icon in `#E9E3D5`.
  - Hover State: Background `rgba(255, 255, 255, 0.08)`, text `#FFFFFF`.
  - Active State: Background `terra-red-100` (`#9D302D`) with left 4px highlight bar or pill contour, text `#FFFFFF` font-medium.
- **Footer**:
  - Staff user avatar, active branch location name, collapse toggle button (`toggle.svg`).

### 6.2. Top Navigation Bar (Header)
- **Background**: Soft warm surface (`#FFFFFF` with subtle bottom border `carbon-20` `#D5D5D5`).
- **Location Selector (Multi-Branch)**:
  - Dropdown badge featuring `location.svg`.
  - Displays active branch: `Richmond` (Default), `Vancouver Admin`, `YVR Airport`, `YYC Calgary`, `Surrey`.
- **Cashier & Operational Tally**:
  - Embedded micro-widget displaying `todays collection.svg` with live cash tally: `Today: $14,280.00 CAD`.
- **Quick Action Button**:
  - `terra-red-100` button with `Add.svg`: **"New Agreement"** (`Shift + N`).

---

## 7. ERP Component Design Specifications

### 7.1. Metric & KPI Summary Cards
Used at the head of Dashboard, Fleet, and Financial reports.

- **Container**: Pure White card (`#FFFFFF`), `rounded-md`, border `1px solid #D5D5D5` (`carbon-20`), subtle shadow.
- **Top Accent Line**: 3px colored top border indicating metric domain:
  - Revenue / Financial: `terra-red-100` (`#9D302D`)
  - Available Fleet / On-Rent: `forest-moss-100` (`#3B511F`)
  - Pending Approvals / Holds: `yellow-100` (`#F1B826`)
  - Grounded / Maintenance: `carbon-80` (`#575656`)
- **Metric Figure**: Set in **Libre Baskerville Bold** (`2rem` / `32px`), color `carbon-100`.
- **Subtext & Trend**: Set in **Helvetica Now Display Regular** (`12px`), color `carbon-60`.

```tsx
<div className="bg-white rounded-md border border-carbon-20 p-5 shadow-xs border-t-4 border-t-terra-100">
  <div className="flex items-center justify-between">
    <span className="text-xs font-semibold tracking-wider uppercase text-carbon-60 font-sans">
      Active Fleet On-Rent
    </span>
    <ErpIcon name="stock-dark" size={18} />
  </div>
  <div className="mt-2 flex items-baseline gap-2">
    <span className="font-serif text-3xl font-bold text-carbon-100">84</span>
    <span className="text-xs text-forest-100 font-medium font-sans">/ 92 Vehicles (91.3%)</span>
  </div>
</div>
```

---

### 7.2. Data Tables & Fleet Rosters
High-density table format engineered for processing 200+ vehicles and reservations efficiently.

- **Header Row (`<thead>`)**:
  - Background: `carbon-10` (`#EAEAEA`) or soft `terra-red-10` (`#F6EBEA`).
  - Font: `Helvetica Now Display Bold`, `11px`, uppercase, tracking `+0.05em`, color `carbon-80`.
  - Border: Bottom `2px solid #D5D5D5`.
- **Data Rows (`<tbody>`)**:
  - Row Height: Compact `38px` to `42px` for maximum viewport record visibility.
  - Alternating Striping: Optional zebra striping (`#FFFFFF` alternating with `#FDFCF9`).
  - Hover State: Smooth background transition to `terra-red-10` (`#F6EBEA`) or `forest-moss-10` (`#ECEEE9`).
  - Active / Selected Row: Left 3px indicator line in `terra-red-100` with subtle `terra-red-10` fill.
  - Border: Bottom `1px solid #EAEAEA` (`carbon-10`).
- **Quick Action Icons**: `edit.svg`, `print.svg`, `view.svg` grouped in rightmost sticky column.

---

### 7.3. Button & Action Hierarchy

| Variant | Normal State | Hover State | Active / Focus | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Primary (Terra)** | `bg-terra-100` (`#9D302D`) text-white font-medium | `bg-terra-80` (`#B15957`) | `ring-2 ring-terra-40` | "Check-Out Vehicle", "Open Contract", "Save Changes" |
| **Secondary (Forest)** | `bg-forest-100` (`#3B511F`) text-white | `bg-forest-80` (`#62744C`) | `ring-2 ring-forest-40` | "Approve Quote", "Verify Licence", "Check-In Return" |
| **Warning (Ember)** | `bg-yellow-100` (`#F1B826`) text-carbon-100 | `bg-yellow-80` (`#F4C651`) | `ring-2 ring-yellow-40` | "Override Rate", "Flag Security Deposit" |
| **Outline (Carbon)** | `border border-carbon-40 bg-white text-carbon-100` | `bg-carbon-10 border-carbon-60` | `ring-2 ring-carbon-40` | "Print Agreement", "Export CSV", "Cancel Dialog" |
| **Ghost** | `bg-transparent text-carbon-80` | `bg-black/5 text-carbon-100` | `rounded-sm` | Table row action icon buttons |
| **Destructive** | `bg-[#9D302D] text-white` | `bg-[#782422]` | `ring-2 ring-red-300` | "Void Contract", "Delete Reservation", "Blacklist" |

---

### 7.4. Status Badges & Pills

Every rental record state has an unequivocal, color-coded visual indicator:

| Status State | Background Fill | Border | Text Color | Icon | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **On-Rent (Active)** | `forest-moss-20` (`#D8DCD2`) | `forest-moss-60` | `forest-moss-100` (`#3B511F`) | `Tick.svg` | Vehicle currently out with customer |
| **Confirmed Reservation** | `terra-red-20` (`#EBD6D5`) | `terra-red-60` | `terra-red-100` (`#9D302D`) | `approve.svg` | Booking confirmed, deposit secured |
| **Pending / Quote** | `yellow-20` (`#FCF1D4`) | `yellow-60` | `#8A6508` (Dark Gold) | `pending.svg` | Quote generated, awaiting payment auth |
| **Overdue / Alert** | `terra-red-100` (`#9D302D`) | `transparent` | `#FFFFFF` (Pure White) | `Bounced.svg` | Return past scheduled timestamp |
| **Maintenance / Grounded**| `carbon-20` (`#D5D5D5`) | `carbon-40` | `carbon-100` (`#2D2C2C`) | `deactivate.svg` | Inspection, bodywork, oil service |
| **Closed / Paid** | `forest-moss-10` (`#ECEEE9`) | `forest-moss-40` | `forest-moss-80` (`#62744C`) | `Tick.svg` | Final folio settled, invoice closed |

---

### 7.5. Form Controls & Rental Data Entry

- **Labels**: `Helvetica Now Display Medium`, `12px`, color `carbon-80`, uppercase with `letter-spacing: +0.025em`.
- **Inputs & Selects**:
  - Background: `#FFFFFF`
  - Border: `1px solid #ABABAB` (`carbon-40`)
  - Border Radius: `0.375rem` (6px)
  - Height: `36px` (`h-9`) for compact ERP ergonomics
  - Font: `Helvetica Now Display Regular`, `14px`, text `carbon-100`
  - Focus Ring: `border-terra-100 ring-2 ring-terra-20`
- **Required Fields**: Red indicator dot `text-terra-100` after label text.
- **Search-Picker Dropdowns**:
  - Used for Customer search and Vehicle search.
  - Instant autocomplete list styled in Pure White card with `shadow-dropdown`.

---

### 7.6. Slide-Over Drawers & Modal Dialogs
Used for Rental Check-In, Check-Out, and Payment Capture.

- **Overlay**: `rgba(45, 44, 44, 0.65)` with subtle `backdrop-blur-sm`.
- **Modal Header**:
  - Background: Pure White with bottom border `carbon-20`.
  - Title: Set in **Libre Baskerville Bold** (`20px`), text `carbon-100`.
  - Close Button: `cross-1.svg` in top-right.
- **Body**: Max height `85vh` with smooth scrollbar, organized in visual collapsible fieldsets.
- **Sticky Footer Actions**:
  - Right-aligned button group: "Cancel" (Outline) + "Complete Check-Out" (Primary Terra Red).

---

### 7.7. Visual Fleet Scheduler & Calendar Matrix

The Visual Fleet Calendar displays vehicles vertically grouped by category (Economy, Full Size, Luxury SUV, Van) against 24-hour / 30-day horizontal timeline slots.

- **Timeline Grid Header**: Date columns with weekend shading (`#E3DDD0` vs `#E9E3D5`).
- **Vehicle Roster (Left column)**: Sticky column with Plate #, Model Year, and current Mileage.
- **Rental Timeline Bars**:
  - Active Rental: `bg-forest-100` with white Helvetica text (Customer name + RA #).
  - Reserved: `bg-terra-80` with diagonal pattern or solid fill.
  - Overdue: `bg-terra-100 animate-pulse` with alert icon.
  - Maintenance Grounded: Striped black/yellow warning bar.

---

### 7.8. Printable Documents (Rental Agreements & Invoices)

Print styles guarantee that printed or PDF-downloaded contracts match the luxury branding:

```css
@media print {
  body {
    background: #FFFFFF !important;
    color: #000000 !important;
  }
  .no-print, [data-sidebar], header {
    display: none !important;
  }
  .print-header {
    border-bottom: 2px solid #9D302D;
    font-family: 'Libre Baskerville', Georgia, serif;
  }
  .contract-table {
    border-collapse: collapse;
    width: 100%;
    font-family: 'Helvetica Now Display', Arial, sans-serif;
  }
}
```

---

## 8. Step-by-Step UI Migration Roadmap

To transition the current codebase in `apps/web/app/(erp)` and `packages/ui`:

1. **Phase 1: Token & Theme Foundations**
   - Update `packages/ui/src/styles/globals.css` with the complete color scales (`terra-red-*`, `forest-moss-*`, `yellow-*`, `carbon-*`).
   - Replace default font classes with `font-serif` (Libre Baskerville) and `font-sans` (Helvetica Now Display).
   - Verify `[data-brand="erp"]` applies `--background: #E9E3D5;` and `--foreground: #2D2C2C;`.

2. **Phase 2: Shell & Sidebar Upgrade**
   - Refactor `apps/web/app/(erp)/_components/shell/sidebar.tsx` to adopt the `.bg-erp-sidebar-pattern` texture.
   - Replace generic Lucide icons with native `/assest/Icons/` SVGs via `<ErpIcon name="..." />`.
   - Update top bar with multi-branch selector (`Richmond`, `Vancouver Admin`, `YVR`, `YYC`, `Surrey`).

3. **Phase 3: Tables & Records Optimization**
   - Apply dense `38px` table rows in Quotes, Reservations, Rentals, and Vehicles.
   - Implement custom status badges using the exact Forest Moss, Terra Red, and Golden Ember pill specifications.
   - Connect `todays collection.svg` and `bill/invoice.svg` to financial drawers.

4. **Phase 4: Inspection & Dialog Polish**
   - Refactor Check-In / Check-Out forms with the new modal headers and action buttons.
   - Style driver licence and insurance document uploads with `upload icon.svg`.

---

*Document version: 1.0.0 — Authoritative specification for Mr Rent A Car ERP Rebuild.*
