import type { Prisma } from "@mrac/db";
import { sendMail } from "./mailer";

type Db = Prisma.TransactionClient;

/**
 * RentCentric's "SMS Providers" (ProvidersMain.aspx): a text goes out as an email to <mobile digits>@<carrier gateway>,
 * through Settings > Email Setup — no separate SMS account. Names match the Provider lists on the SMS forms.
 */
export const SMS_GATEWAYS: [provider: string, gateway: string][] = [
  ["Aircel(India)", "aircel.co.in"],
  ["Airtel(Andhra Pradesh, India)", "airtelap.com"],
  ["Airtel(Karnataka, India)", "airtelkkk.com"],
  ["Alaska Communications Systems(USA)", "msg.acsalaska.net"],
  ["Alltel Wireless(USA)", "text.wireless.alltel.com"],
  ["aql(UK)", "text.aql.com"],
  ["AT&T Enterprise Paging(USA)", "page.att.net"],
  ["AT&T Mobility (formerly Cingular)(USA)", "txt.att.net"],
  ["AT&T Wireless(USA)", "txt.att.net"],
  ["AT&T(USA)", "mmode.com"],
  ["Bell Mobility & Solo Mobile(Canada)", "txt.bell.ca"],
  ["Boost Mobile(USA)", "boostmobile.com"],
  ["Bouygues Télécom (company)(France)", "mms.bouyguestelecom.fr"],
  ["Cellular One (Dobson)(USA)", "mobile.celloneusa.com"],
  ["Centennial Wireless", "cwemail.com"],
  ["Cincinnati Bell(Cincinnati, Ohio, USA)", "gocbw.com"],
  ["Cingular (GoPhone prepaid)(USA)", "cingulartext.com"],
  ["Cingular (Postpaid)(USA)", "cingular.com"],
  ["Claro(Brasil)", "clarotorpedo.com.br"],
  ["Claro(Nicaragua)", "ideasclaro-ca.com"],
  ["Comcel(Colombia)", "comcel.com.co"],
  ["Cricket", "sms.mycricket.com"],
  ["CTI Móvil (Now Claro)(Argentina)", "sms.ctimovil.com.ar"],
  ["Emtel(Mauritius)", "emtelworld.net"],
  ["Fido(Canada)", "fido.ca"],
  ["Freebie SMS(Europe)", "smssturen.com"],
  ["General Communications Inc.(Alaska)", "mobile.gci.net"],
  ["Globalstar (satellite)", "msg.globalstarusa.com"],
  ["Golden State Cellular(California)", "gscsms.com"],
  ["Helio", "myhelio.com"],
  ["i wireless (T-Mobile)", "number.iws@iwspcs.net"],
  ["Iridium", "msg.iridium.com"],
  ["i-wireless (Sprint PCS)", "iwirelesshometext.com"],
  ["Koodo Mobile(Canada)", "msg.telus.com"],
  ["Loop (BPL Mobile)(Mumbai, India)", "bplmobile.com"],
  ["Mero Mobile(Nepal)", "977sms.spicenepal.com"],
  ["MetroPCS", "mymetropcs.com"],
  ["Mobitel(Sri Lanka)", "sms.mobitel.lk"],
  ["Movicom", "movimensaje.com.ar"],
  ["Movistar(Colombia)", "movistar.com.co"],
  ["MTN(South Africa)", "sms.co.za"],
  ["MTS Mobility(Canada)", "text.mtsmobility.com"],
  ["Nextel(Argentina)", "TwoWay.11nextel.net.ar"],
  ["Nextel(México)", "msgnextel.com.mx"],
  ["Nextel(United States)", "messaging.nextel.com"],
  ["PC Telecom(Canada)", "mobiletxt.ca"],
  ["Personal(Argentina)", "alertas.personal.com.ar"],
  ["Plus(Poland)", "+48text.plusgsm.pl"],
  ["Qwest Wireless(USA)", "qwestmp.com"],
  ["Rogers Wireless(Canada)", "pcs.rogers.com"],
  ["SaskTel(Canada)", "sms.sasktel.com"],
  ["Setar Mobile email (Aruba)(Aruba)", "297+mas.aw"],
  ["Sprint (Nextel)(USA)", "page.nextel.com"],
  ["Sprint (PCS)(USA)", "messaging.sprintpcs.com"],
  ["Suncom", "tms.suncom.com"],
  ["Sunrise Communications(Switzerland)", "gsm.sunrise.ch"],
  ["Syringa Wireless(USA)", "rinasms.com"],
  ["Telus Mobility(Canada)", "msg.telus.com"],
  ["Tigo (Formerly Ola)(Colombia)", "sms.tigo.com.co"],
  ["T-Mobile(Austria)", "sms.t-mobile.at"],
  ["T-Mobile(Croatia)", "385sms.t-mobile.hr"],
  ["Unicel(USA)", "utext.com"],
  ["US Cellular(USA)", "email.uscc.net"],
  ["Verizon(USA)", "vtext.com"],
  ["Viaero(USA)", "viaerosms.com"],
  ["Virgin Mobile(Canada)", "vmobile.ca"],
  ["Virgin Mobile(USA)", "bills.com"],
  ["Vivo(Brasil)", "torpedoemail.com.br"],
  ["Vodacom(South Africa)", "voda.co.za"],
];

export const smsGateway = (provider: string | null | undefined) => SMS_GATEWAYS.find(([n]) => n === provider)?.[1] ?? null;

/** Send a text: an email to the carrier's gateway (logged in the email log). Throws a readable error when it can't. */
export async function sendSms(
  db: Db,
  msg: { phone: string; provider: string | null | undefined; text: string; entityType?: string; entityId?: string; sentById?: string | null },
) {
  const digits = msg.phone.replace(/\D/g, "");
  const gateway = smsGateway(msg.provider);
  if (!gateway) throw new Error(`Unknown SMS provider "${msg.provider ?? ""}".`);
  if (digits.length < 10) throw new Error("The mobile number needs at least 10 digits.");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await sendMail(db, {
    to: `${digits}@${gateway}`, subject: "Mr Rent A Car", html: esc(msg.text).replace(/\n/g, "<br />"),
    entityType: msg.entityType, entityId: msg.entityId, templateName: "SMS", sentById: msg.sentById ?? null,
  });
}

/** Fill ##Keyword## from the values (missing ones become empty). */
export const fillKeywords = (text: string, values: Record<string, string | number | null | undefined>) =>
  text.replace(/##(\w+)##/g, (_, k: string) => String(values[k] ?? ""));
