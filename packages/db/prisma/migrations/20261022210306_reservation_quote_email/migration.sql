-- AlterTable
ALTER TABLE "EmailSettings" ADD COLUMN     "quoteBody" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "quoteSubject" TEXT NOT NULL DEFAULT 'Quote';

-- CreateTable
CREATE TABLE "ReservationEmailSetup" (
    "locationId" TEXT NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "format" TEXT NOT NULL DEFAULT 'HTML',
    "copyTo" TEXT,
    "subject" TEXT NOT NULL DEFAULT 'Reservation Confirmation',
    "body" TEXT NOT NULL DEFAULT '',
    "identityVerificationUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationEmailSetup_pkey" PRIMARY KEY ("locationId")
);

-- AddForeignKey
ALTER TABLE "ReservationEmailSetup" ADD CONSTRAINT "ReservationEmailSetup_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RentCentric's Quote Email (QuoteCustomerEmail.aspx)
INSERT INTO "EmailSettings" ("id", "updatedAt", "quoteSubject", "quoteBody") VALUES ('default', NOW(), 'Quote', $qb$                    <table width="600" border="0" cellspacing="0" cellpadding="2" style="font-size: 8pt;
                        font-family: tahoma, verdana, helvetica, arial, sans-serif; color: Black;">
                        <tr>
                            <td width="181">
                                ##LocationLogo##
                            </td>
                            <td valign="top">
                                ##LocationName##<br />
                                ##Address##<br />
                                ##City##, ##State##, ##Zip##<br />
                                ##Country##
                            </td>
                            <td width="141" valign="top">
                                TollFree:##TollFree##<br />
                                Phone: ##Phone##<br />
                                Fax: ##fax##<br />
                                Email: <a href='mailto:##Email##'>##Email##</a>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="3">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td width="64%">
                                            <hr size="3" width="100%" noshade="noshade" color="#37648E" align="right" />
                                            <hr size="1" width="100%" noshade="noshade" color="#37648e" align="right" />
                                        </td>
                                        <td width="14%">
                                            <font color="#37648E" size="5" face="Verdana, Arial, Helvetica, sans-serif"><strong>
                                                <em>Quote</em></strong>
                                        </td>
                                        <td width="22%">
                                            <hr size="3" width="100%" noshade="noshade" color="#37648E" align="right" />
                                            <hr size="1" width="100%" noshade="noshade" color="#37648e" align="right" />
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Quote Number:
                            </td>
                            <td colspan="2">
                                ##QuoteNumber##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Date:
                            </td>
                            <td colspan="2">
                                ##QuoteDate##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Quote By:
                            </td>
                            <td colspan="2">
                                ##AdminName##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                First Name:
                            </td>
                            <td colspan="2">
                                ##FirstName##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Last Name:
                            </td>
                            <td colspan="2">
                                ##LastName##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Email:
                            </td>
                            <td colspan="2">
                                ##CustomerEmail##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Phone:
                            </td>
                            <td colspan="2">
                                ##CustomerPhone##
                            </td>
                        </tr>
                        <tr bgcolor="#F1F1F1">
                            <td>
                                <strong>Your Vehicle</strong>
                            </td>
                            <td colspan="2">
                                &nbsp;
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <table width="100%" border="0" cellspacing="0" cellpadding="3" style="font-size: 8pt;
                                    font-family: tahoma, verdana, helvetica, arial, sans-serif; color: Black;">
                                    <tr>
                                        <td>
                                            ##VehicleType##
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            ##NumberOfDoors## Doors
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            ##NumberOfPassengers## Passengers
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            ##NumberOfLuggages## Luggages
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td colspan="2">
                                ##VehicleTypeImage##
                            </td>
                        </tr>
                        <tr bgcolor="#F1F1F1">
                            <td>
                                <strong>Your Time and Place</strong>
                            </td>
                            <td colspan="2">
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Pickup Location:
                            </td>
                            <td colspan="2">
                                ##PickupLocation##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Return Location:
                            </td>
                            <td colspan="2">
                                ##ReturnLocation##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Pickup Date:
                            </td>
                            <td colspan="2">
                                ##PickupDate##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Return Date:
                            </td>
                            <td colspan="2">
                                ##ReturnDate##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Rental Days:
                            </td>
                            <td colspan="2">
                                ##RentalDays##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Total Mileage Included:
                            </td>
                            <td colspan="2">
                                ##TotalMileageIncluded##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Mileage Included:
                            </td>
                            <td colspan="2">
                                Daily: ##Daily##, Weekly: ##Weekly##, Monthly: ##Monthly##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Fuel Charge:
                            </td>
                            <td colspan="2">
                                ##FuelCharge##
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Grace Minutes:
                            </td>
                            <td colspan="2">
                                ##GraceMinutes##
                            </td>
                        </tr>
                        <tr>
                            <td colspan="3">
                                ##ChargesSummary##
                            </td>
                        </tr>
                        <tr>
                            <td colspan="3">
                                <p>
                                    Visit our website at <a href='##website##' target='_blank'>##website##</a>
                                    <br />
                                    Thank you very much for your business.</p>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="3">
                                &nbsp;
                            </td>
                        </tr>
                    </table>
                $qb$)
ON CONFLICT ("id") DO UPDATE SET "quoteSubject" = EXCLUDED."quoteSubject", "quoteBody" = EXCLUDED."quoteBody";

-- RentCentric's Reservation Email (WebCustomerEmailSetup.aspx, as at Surrey): From, copy to staff, subject; body empty = the confirmation template
INSERT INTO "ReservationEmailSetup" ("locationId", "fromName", "fromEmail", "format", "copyTo", "subject", "body", "updatedAt")
SELECT "id", 'VINCENT@MRRENTACAR.COM', 'VINCENT@MRRENTACAR.COM', 'HTML', 'VINCENT@MRRENTACAR.COM', 'Reservation Confirmation', '', NOW() FROM "Location"
ON CONFLICT ("locationId") DO NOTHING;
