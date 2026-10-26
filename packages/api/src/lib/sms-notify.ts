import type { Prisma } from "@mrac/db";
import { fillKeywords, sendSms } from "./sms";

type Db = Prisma.TransactionClient;

/** RentCentric's New Reservation Notifications keywords, in its order (Settings > SMS Notifications Setup). */
export const NEW_RES_KEYWORDS = ["FullName", "LocationName", "LocationAddress", "Zip", "ReservationID", "CheckoutDate", "CheckInDate", "Website", "Phone", "TollFreeNumber", "Vehicle", "Rate", "Miles", "Amount", "CustomerPhone"];
/** Real Time Dashboard Notifications keywords. */
export const DASHBOARD_KEYWORDS = ["FullName", "TotalVehicles", "RentalToday", "OnRent", "Returned", "Available", "RemainingReturns", "DueIn", "OverDue", "ResRemaining", "RezToday", "NoShowup", "ResTomorrow"];

/**
 * Text the SMS Notification Users who take "New Reservation Message" (all locations, or this reservation's) when
 * Settings > SMS Notifications Setup has it enabled. Never throws: a failed text is in the email log, the booking stands.
 */
export async function notifyNewReservation(db: Db, reservationId: string) {
  const s = await db.emailSettings.findUnique({ where: { id: "default" }, select: { smsNewResEnabled: true, smsNewResMessage: true } });
  if (!s?.smsNewResEnabled || !s.smsNewResMessage.trim()) return 0;
  const r = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      number: true, pickupAt: true, returnAt: true, firstName: true, lastName: true, phone: true, pickupLocationId: true,
      customer: { select: { firstName: true, lastName: true, phone: true, cellPhone: true } },
      pickupLocation: { select: { name: true, address1: true, city: true, postal: true, phone: true, tollFree: true, timeZone: true } },
      vehicleType: { select: { name: true } }, rate: { select: { code: true } }, chargeLines: { select: { kind: true, units: true, total: true } },
    },
  });
  if (!r) return 0;
  const users = await db.smsNotificationUser.findMany({ where: { isActive: true, newReservation: true, OR: [{ locationId: null }, { locationId: r.pickupLocationId }] } });
  if (!users.length) return 0;
  const when = (d: Date) => d.toLocaleString("en-US", { timeZone: r.pickupLocation.timeZone, dateStyle: "short", timeStyle: "short" });
  const km = r.chargeLines.find((l) => l.kind === "MILEAGE" && !Number(l.total));
  const text = (fullName: string) =>
    fillKeywords(s.smsNewResMessage, {
      FullName: fullName,
      LocationName: r.pickupLocation.name,
      LocationAddress: [r.pickupLocation.address1, r.pickupLocation.city].filter(Boolean).join(", "),
      Zip: r.pickupLocation.postal,
      ReservationID: r.number,
      CheckoutDate: when(r.pickupAt),
      CheckInDate: when(r.returnAt),
      Website: "http://www.mrrentacar.com",
      Phone: r.pickupLocation.phone,
      TollFreeNumber: r.pickupLocation.tollFree,
      Vehicle: r.vehicleType.name,
      Rate: r.rate?.code,
      Miles: km ? Number(km.units) : "",
      Amount: `$${r.chargeLines.reduce((a, l) => a + Number(l.total), 0).toFixed(2)}`,
      CustomerPhone: r.customer?.cellPhone ?? r.customer?.phone ?? r.phone,
    });
  const customer = [r.customer?.firstName ?? r.firstName, r.customer?.lastName ?? r.lastName].filter(Boolean).join(" ");
  let sent = 0;
  for (const u of users) {
    try {
      await sendSms(db, { phone: u.phone, provider: u.provider, text: text(customer), entityType: "Reservation", entityId: reservationId });
      sent++;
    } catch {
      // logged as FAILED in the email log (e.g. email not set up yet)
    }
  }
  return sent;
}
