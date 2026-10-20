/* eslint-disable @next/next/no-img-element -- static SVG operational icons served from apps/web/public/assest/ */
import * as React from "react";
import { cn } from "../lib/utils";

export type ErpIconName =
  | "add"
  | "add-1"
  | "bank"
  | "bounced"
  | "change-order"
  | "cheque"
  | "company"
  | "customer"
  | "customers"
  | "delete"
  | "dollar"
  | "draft"
  | "icon"
  | "list"
  | "list-1"
  | "print"
  | "routes"
  | "tick"
  | "truck"
  | "vector"
  | "view"
  | "approve"
  | "bag"
  | "bag-1"
  | "collection"
  | "cross"
  | "cross-1"
  | "deactivate"
  | "download"
  | "edit"
  | "location"
  | "lock"
  | "pending"
  | "record-payment"
  | "refresh"
  | "reject"
  | "save"
  | "shapes"
  | "stock"
  | "stock-dark"
  | "todays-collection"
  | "toggle"
  | "upload"
  | "invoice"
  | "order";

const ICON_PATHS: Record<ErpIconName, string> = {
  "add": "/assest/Icons/Add.svg",
  "add-1": "/assest/Icons/Add-1.svg",
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
  "icon": "/assest/Icons/Icon.svg",
  "list": "/assest/Icons/List.svg",
  "list-1": "/assest/Icons/List-1.svg",
  "print": "/assest/Icons/Print.svg",
  "routes": "/assest/Icons/Routes.svg",
  "tick": "/assest/Icons/Tick.svg",
  "truck": "/assest/Icons/Truck.svg",
  "vector": "/assest/Icons/Vector.svg",
  "view": "/assest/Icons/View.svg",
  "approve": "/assest/Icons/approve.svg",
  "bag": "/assest/Icons/bag.svg",
  "bag-1": "/assest/Icons/bag-1.svg",
  "collection": "/assest/Icons/collection.svg",
  "cross": "/assest/Icons/cross.svg",
  "cross-1": "/assest/Icons/cross-1.svg",
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
  "shapes": "/assest/Icons/shapes.svg",
  "stock": "/assest/Icons/stock.svg",
  "stock-dark": "/assest/Icons/stock-dark.svg",
  "todays-collection": "/assest/Icons/todays collection.svg",
  "toggle": "/assest/Icons/toggle.svg",
  "upload": "/assest/Icons/upload icon.svg",
  "invoice": "/assest/Icons/bill/invoice.svg",
  "order": "/assest/Icons/box/order.svg",
};

export interface ErpIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: ErpIconName;
  size?: number;
  className?: string;
  alt?: string;
}

export function ErpIcon({ name, size = 18, className, style, alt = "", ...props }: ErpIconProps) {
  const path = ICON_PATHS[name];
  return (
    <span
      className={cn("inline-block shrink-0 select-none", className)}
      style={{
        width: size,
        height: size,
        maskImage: `url("${path}")`,
        WebkitMaskImage: `url("${path}")`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        backgroundColor: "currentColor",
        ...style,
      }}
      aria-label={alt || undefined}
      aria-hidden={!alt}
      {...props}
    />
  );
}
