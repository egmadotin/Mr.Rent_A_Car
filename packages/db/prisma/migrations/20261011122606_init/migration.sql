-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('STAFF', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "LookupKind" AS ENUM ('VEHICLE_CATEGORY', 'VEHICLE_BODY', 'FUEL_TYPE', 'ENGINE_BRAND', 'ENGINE_TYPE', 'VEHICLE_OPTION', 'COMPANY_TYPE', 'CUSTOMER_REGION', 'DISCOUNT_REASON', 'RENTAL_REASON');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ON_RENT', 'HOLD_FOR_SALE', 'AUCTION');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('NONE', 'AUTOMATIC', 'MANUAL', 'TIPTRONIC');

-- CreateEnum
CREATE TYPE "PowerTrain" AS ENUM ('FOUR_BY_TWO', 'FOUR_BY_FOUR');

-- CreateEnum
CREATE TYPE "RateCalculation" AS ENUM ('HOUR_24', 'CALENDAR_DAY', 'FLAT');

-- CreateEnum
CREATE TYPE "RateValidFor" AS ENUM ('DATE_RANGE', 'SEASON');

-- CreateEnum
CREATE TYPE "TaxKind" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('LIABILITY_ONLY', 'FULL_COVERAGE');

-- CreateEnum
CREATE TYPE "IdentityVerificationMethod" AS ENUM ('MANUAL', 'PLUSTEK', 'PLAID', 'YOTI');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('OPEN', 'CLOSED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('TIME', 'MILEAGE', 'UPGRADE', 'DISCOUNT', 'FUEL', 'PREPAID_FUEL', 'MISC', 'ONE_WAY', 'DAMAGES', 'TRAFFIC_TICKETS', 'ADMIN', 'OTHER', 'TAX');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('AMEX', 'CASH', 'DEBIT', 'EMT', 'INTERNAL', 'MASTERCARD', 'VISA');

-- CreateEnum
CREATE TYPE "PaymentTransactionType" AS ENUM ('PAYMENT', 'AUTHORIZATION', 'REFUND');

-- CreateEnum
CREATE TYPE "MemoKind" AS ENUM ('MEMO', 'NOTE');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'DOCUMENT', 'SCANNED_ID');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('RENTER', 'THIRD_PARTY', 'OTHER');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "kind" "UserKind" NOT NULL DEFAULT 'STAFF',
    "userGroupId" TEXT,
    "defaultLocationId" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "impersonatedBy" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT[],

    CONSTRAINT "UserGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "name" TEXT NOT NULL,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postal" TEXT,
    "country" TEXT DEFAULT 'CA',
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "isOffsite" BOOLEAN NOT NULL DEFAULT false,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationHours" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LocationHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lookup" (
    "id" TEXT NOT NULL,
    "kind" "LookupKind" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Lookup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleType" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "name" TEXT NOT NULL,
    "sippCode" TEXT,
    "description" TEXT,
    "seats" INTEGER,
    "luggage" INTEGER,
    "doors" INTEGER,
    "imageKey" TEXT,
    "displayOnline" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMake" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "VehicleMake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleModel" (
    "id" TEXT NOT NULL,
    "makeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "VehicleModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedId" TEXT NOT NULL,
    "name" TEXT,
    "makeId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelCode" TEXT,
    "year" INTEGER,
    "colour" TEXT NOT NULL,
    "doors" INTEGER,
    "cylinders" INTEGER,
    "transmission" "Transmission",
    "vehicleTypeId" TEXT NOT NULL,
    "vin" TEXT,
    "memo" TEXT,
    "rentalLocationId" TEXT NOT NULL,
    "owningLocationId" TEXT NOT NULL,
    "currentLocationId" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "categoryId" TEXT,
    "bodyId" TEXT,
    "fuelTypeId" TEXT,
    "tankSize" INTEGER NOT NULL,
    "fuelLevel" INTEGER NOT NULL DEFAULT 16,
    "originalOdometer" INTEGER,
    "currentOdometer" INTEGER,
    "spotNumber" TEXT,
    "keyNumber" TEXT,
    "isExclusiveFleet" BOOLEAN NOT NULL DEFAULT false,
    "gpsTrackerId" TEXT,
    "gpsLatitude" DECIMAL(9,6),
    "gpsLongitude" DECIMAL(9,6),
    "gpsUpdatedAt" TIMESTAMP(3),
    "maintenanceBeginOdometer" INTEGER,
    "maintenanceBeginDate" DATE,
    "maintenanceEveryKm" INTEGER NOT NULL,
    "insuranceAmount" DECIMAL(10,2) NOT NULL,
    "inspectionDate" DATE,
    "inspectionAmount" DECIMAL(10,2),
    "licenseNumber" TEXT NOT NULL,
    "licenseProvince" TEXT,
    "licenseAmount" DECIMAL(10,2),
    "licenseFirstRegistered" DATE,
    "licenseExpiry" DATE,
    "ldwMonthlyRate" DECIMAL(10,2),
    "powerTrain" "PowerTrain",
    "fuelGrade" TEXT,
    "oilType" TEXT,
    "dimensions" TEXT,
    "maxPayload" TEXT,
    "verticalClearance" TEXT,
    "frontTirePressure" TEXT,
    "rearTirePressure" TEXT,
    "engineBrandId" TEXT,
    "engineTypeId" TEXT,
    "gvwr" TEXT,
    "cityMpg" DECIMAL(5,1),
    "highwayMpg" DECIMAL(5,1),
    "interiorColor" TEXT,
    "interiorRgb" TEXT,
    "exteriorRgb" TEXT,
    "stereo" TEXT,
    "subscriptionPlanId" TEXT,
    "monthlyPlanId" TEXT,
    "yearlyPlanId" TEXT,
    "weeklyLowMileagePlanId" TEXT,
    "weeklyHighMileagePlanId" TEXT,
    "monthlyLowMileagePlanId" TEXT,
    "monthlyHighMileagePlanId" TEXT,
    "marketingDescription" TEXT,
    "retailPriceLow" DECIMAL(10,2),
    "retailPriceHigh" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleOption" (
    "vehicleId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "VehicleOption_pkey" PRIMARY KEY ("vehicleId","optionId")
);

-- CreateTable
CREATE TABLE "VehicleBlock" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reservationId" TEXT,
    "rentalId" TEXT,

    CONSTRAINT "VehicleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "code" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "calculationBy" "RateCalculation" NOT NULL,
    "rateType" TEXT NOT NULL,
    "validFor" "RateValidFor" NOT NULL DEFAULT 'DATE_RANGE',
    "effectiveDate" DATE,
    "endDate" DATE,
    "extraKmCharge" DECIMAL(10,2) NOT NULL,
    "graceMinutes" INTEGER NOT NULL,
    "fuelChargePerUnit" DECIMAL(10,2) NOT NULL,
    "minChargeDays" INTEGER NOT NULL,
    "minChargeHours" INTEGER,
    "skipHourly" BOOLEAN NOT NULL DEFAULT false,
    "displayOnline" BOOLEAN NOT NULL DEFAULT false,
    "valuePricing" BOOLEAN NOT NULL DEFAULT false,
    "dateSpecific" BOOLEAN NOT NULL DEFAULT false,
    "rentcarsCom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateValue" (
    "id" TEXT NOT NULL,
    "rateId" TEXT NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,
    "hourly" DECIMAL(10,2),
    "daily" DECIMAL(10,2),
    "weekly" DECIMAL(10,2),
    "monthly" DECIMAL(10,2),
    "kmAllowed" INTEGER,

    CONSTRAINT "RateValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateSeason" (
    "rateId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,

    CONSTRAINT "RateSeason_pkey" PRIMARY KEY ("rateId","seasonId")
);

-- CreateTable
CREATE TABLE "MiscCharge" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "calculationBy" "RateCalculation" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MiscCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tax" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TaxKind" NOT NULL DEFAULT 'PERCENT',
    "value" DECIMAL(10,3) NOT NULL,
    "perDay" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "name" TEXT NOT NULL,
    "typeId" TEXT,
    "code" TEXT,
    "contactName" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postal" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "taxName" TEXT,
    "taxAddress" TEXT,
    "taxId" TEXT,
    "claimsOffice" TEXT,
    "minimumAge" INTEGER,
    "insuranceCompany" TEXT,
    "insuranceRep" TEXT,
    "policyNumber" TEXT,
    "policyExpiry" DATE,
    "mileageCap" INTEGER,
    "iataNumber" TEXT,
    "parentIataId" TEXT,
    "partnerPointId" TEXT,
    "curp" TEXT,
    "folio" TEXT,
    "ssn" TEXT,
    "copyInsuranceToRental" BOOLEAN NOT NULL DEFAULT false,
    "isUndesired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "birthDate" DATE,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postal" TEXT,
    "country" TEXT,
    "regionId" TEXT,
    "phone" TEXT,
    "cellPhone" TEXT,
    "localPhone" TEXT,
    "email" TEXT,
    "emergencyContactPhone" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiry" DATE,
    "licenseProvince" TEXT,
    "licenseCountry" TEXT,
    "motorcycleLicensed" BOOLEAN,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityVerifiedMethod" "IdentityVerificationMethod",
    "identityVerifiedAt" TIMESTAMP(3),
    "identityVerifiedById" TEXT,
    "checkYotiVerification" BOOLEAN NOT NULL DEFAULT false,
    "insuranceCompany" TEXT,
    "insurancePolicyNumber" TEXT,
    "insurancePolicyHolder" TEXT,
    "insuranceType" "InsuranceType",
    "insuranceExpiry" DATE,
    "insurancePhone" TEXT,
    "insuranceFax" TEXT,
    "companyId" TEXT,
    "companyPhone" TEXT,
    "jobPosition" TEXT,
    "referralId" TEXT,
    "passportNumber" TEXT,
    "aaaMembershipNumber" TEXT,
    "frequentTravelerId" TEXT,
    "taxId" TEXT,
    "hstNumber" TEXT,
    "dbaName" TEXT,
    "bandName" TEXT,
    "pin" TEXT,
    "ssn" TEXT,
    "approvedBy" TEXT,
    "defaultLocationId" TEXT,
    "enteredLocationId" TEXT,
    "registrationChannel" TEXT,
    "isUndesired" BOOLEAN NOT NULL DEFAULT false,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isClubMember" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribedFromMarketing" BOOLEAN NOT NULL DEFAULT false,
    "allVehicleBodies" BOOLEAN NOT NULL DEFAULT false,
    "primaryCustomerId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "holderName" TEXT,
    "processorToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "legacyId" INTEGER,
    "pickupAt" TIMESTAMP(3) NOT NULL,
    "returnAt" TIMESTAMP(3) NOT NULL,
    "pickupLocationId" TEXT NOT NULL,
    "returnLocationId" TEXT NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,
    "rateId" TEXT,
    "companyId" TEXT,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(10,2),
    "referralId" TEXT,
    "customerId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "legacyId" INTEGER,
    "status" "ReservationStatus" NOT NULL DEFAULT 'TENTATIVE',
    "customerId" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "locationId" TEXT NOT NULL,
    "pickupLocationId" TEXT NOT NULL,
    "returnLocationId" TEXT NOT NULL,
    "pickupAt" TIMESTAMP(3) NOT NULL,
    "returnAt" TIMESTAMP(3) NOT NULL,
    "vehicleTypeId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "rateId" TEXT,
    "companyId" TEXT,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(10,2),
    "discountReasonId" TEXT,
    "deposit" DECIMAL(10,2),
    "referralId" TEXT,
    "deliveryAddress" TEXT,
    "airline" TEXT,
    "flightNumber" TEXT,
    "hotel" TEXT,
    "arrivalAirport" TEXT,
    "preferredLanguage" TEXT,
    "poNumber" TEXT,
    "roNumber" TEXT,
    "customerNotes" TEXT,
    "isLoaner" BOOLEAN NOT NULL DEFAULT false,
    "isNonRevenue" BOOLEAN NOT NULL DEFAULT false,
    "confirmationEmailSentAt" TIMESTAMP(3),
    "quoteId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transport" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "rentalId" TEXT,
    "pickupLocationId" TEXT,
    "pickupLocationName" TEXT,
    "pickupAddress" TEXT,
    "pickupCity" TEXT,
    "pickupProvince" TEXT,
    "pickupPostal" TEXT,
    "pickupCountry" TEXT,
    "pickupPhone" TEXT,
    "pickupAt" TIMESTAMP(3),
    "pickupAirport" TEXT,
    "pickupFlightNumber" TEXT,
    "pickupMemo" TEXT,
    "dropoffLocationId" TEXT,
    "dropoffLocationName" TEXT,
    "dropoffAddress" TEXT,
    "dropoffCity" TEXT,
    "dropoffProvince" TEXT,
    "dropoffPostal" TEXT,
    "dropoffCountry" TEXT,
    "dropoffPhone" TEXT,
    "dropoffAt" TIMESTAMP(3),
    "dropoffAirline" TEXT,
    "frequentFlyerNumber" TEXT,
    "dropoffMemo" TEXT,

    CONSTRAINT "Transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "raNumber" SERIAL NOT NULL,
    "legacyId" INTEGER,
    "status" "RentalStatus" NOT NULL DEFAULT 'OPEN',
    "reservationId" TEXT,
    "quoteId" TEXT,
    "customerId" TEXT NOT NULL,
    "companyId" TEXT,
    "checkOutLocationId" TEXT NOT NULL,
    "checkInLocationId" TEXT NOT NULL,
    "checkOutAt" TIMESTAMP(3) NOT NULL,
    "expectedReturnAt" TIMESTAMP(3) NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "checkOutChannel" TEXT,
    "checkInChannel" TEXT,
    "vehicleTypeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "odometerOut" INTEGER NOT NULL,
    "odometerIn" INTEGER,
    "fuelOut" INTEGER,
    "fuelIn" INTEGER,
    "prepaidFuel" BOOLEAN NOT NULL DEFAULT false,
    "rateId" TEXT,
    "discountType" "DiscountType",
    "discountValue" DECIMAL(10,2),
    "discountReasonId" TEXT,
    "deposit" DECIMAL(10,2),
    "isLongTerm" BOOLEAN NOT NULL DEFAULT false,
    "invoicingPeriod" TEXT,
    "referralId" TEXT,
    "rentalReasonId" TEXT,
    "claimNumber" TEXT,
    "airport" TEXT,
    "airline" TEXT,
    "flightNumber" TEXT,
    "poNumber" TEXT,
    "roNumber" TEXT,
    "isNonRevenue" BOOLEAN NOT NULL DEFAULT false,
    "openedById" TEXT,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "exchangeRate" DECIMAL(12,6),

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingDriver" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reservationId" TEXT,
    "rentalId" TEXT,

    CONSTRAINT "BookingDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT,
    "reservationId" TEXT,
    "rentalId" TEXT,
    "kind" "ChargeKind" NOT NULL,
    "name" TEXT NOT NULL,
    "units" DECIMAL(10,2) NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "miscChargeId" TEXT,
    "taxId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChargeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "reservationId" TEXT,
    "rentalId" TEXT,
    "customerId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "transactionType" "PaymentTransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "authorizationCode" TEXT,
    "transactionCode" TEXT,
    "creditCardId" TEXT,
    "cardLast4" TEXT,
    "takenById" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentDetail" TEXT,
    "paymentDetailCont" TEXT,
    "companyId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memo" (
    "id" TEXT NOT NULL,
    "kind" "MemoKind" NOT NULL DEFAULT 'MEMO',
    "body" TEXT NOT NULL,
    "showAsPopup" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "quoteId" TEXT,
    "reservationId" TEXT,
    "rentalId" TEXT,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT,
    "customerId" TEXT,
    "rentalId" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalVehicleSegment" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "odometerOut" INTEGER NOT NULL,
    "odometerIn" INTEGER,
    "fuelOut" INTEGER,
    "fuelIn" INTEGER,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RentalVehicleSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficTicket" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "ticketDate" TIMESTAMP(3) NOT NULL,
    "offense" TEXT NOT NULL,
    "location" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "officer" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT,
    "payMethod" "PaymentMethod",
    "creditCardId" TEXT,
    "processCreditCard" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "attachmentKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjustment" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "kind" "ChargeKind" NOT NULL,
    "miscChargeId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "enteredById" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillSplit" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "claimType" "ClaimType" NOT NULL,
    "insuranceCompany" TEXT,
    "policyNumber" TEXT,
    "policyExpiry" DATE,
    "prePaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lumpSum" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amountPerDay" DECIMAL(10,2) NOT NULL,
    "numberOfDays" INTEGER NOT NULL,
    "adjuster" TEXT,
    "insured" TEXT,
    "roNumber" TEXT,
    "poNumber" TEXT,
    "lossDate" DATE,
    "claimNumber" TEXT,
    "maxPay" DECIMAL(10,2),
    "percentCoPay" INTEGER NOT NULL DEFAULT 0,
    "payAllTaxes" BOOLEAN NOT NULL DEFAULT false,
    "payTotal" BOOLEAN NOT NULL DEFAULT false,
    "deductFromCustomersBalance" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillSplitTax" (
    "billSplitId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,

    CONSTRAINT "BillSplitTax_pkey" PRIMARY KEY ("billSplitId","taxId")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "referralId" TEXT,
    "userId" TEXT,
    "enteredById" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "claimDate" TIMESTAMP(3) NOT NULL,
    "claimNumber" TEXT,
    "closeDate" TIMESTAMP(3),
    "type" "ClaimType" NOT NULL,
    "location" TEXT,
    "policeDept" TEXT,
    "policeRep" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'OPEN',
    "deductible" DECIMAL(10,2),
    "totalPayments" DECIMAL(10,2),
    "memo" TEXT,
    "hasAccidentReport" BOOLEAN NOT NULL DEFAULT false,
    "hasRenterInsurancePolicy" BOOLEAN NOT NULL DEFAULT false,
    "hasPoliceReport" BOOLEAN NOT NULL DEFAULT false,
    "hasRentalAgreement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalInvoice" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "invoiceNumber" SERIAL NOT NULL,
    "numberOfDays" INTEGER NOT NULL,
    "beginDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroup_name_key" ON "UserGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_legacyId_key" ON "Location"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationHours_locationId_dayOfWeek_key" ON "LocationHours"("locationId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Lookup_kind_name_key" ON "Lookup"("kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_legacyId_key" ON "Referral"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_name_key" ON "Referral"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_legacyId_key" ON "VehicleType"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_name_key" ON "VehicleType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleMake_name_key" ON "VehicleMake"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_makeId_name_key" ON "VehicleModel"("makeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_legacyId_key" ON "Vehicle"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_assignedId_key" ON "Vehicle"("assignedId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleTypeId_rentalLocationId_status_idx" ON "Vehicle"("vehicleTypeId", "rentalLocationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleBlock_reservationId_key" ON "VehicleBlock"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleBlock_rentalId_key" ON "VehicleBlock"("rentalId");

-- CreateIndex
CREATE INDEX "VehicleBlock_vehicleId_startsAt_idx" ON "VehicleBlock"("vehicleId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Rate_legacyId_key" ON "Rate"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Rate_locationId_code_key" ON "Rate"("locationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RateValue_rateId_vehicleTypeId_key" ON "RateValue"("rateId", "vehicleTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "MiscCharge_legacyId_key" ON "MiscCharge"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_legacyId_key" ON "Company"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_legacyId_key" ON "Customer"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_lastName_firstName_idx" ON "Customer"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_licenseNumber_idx" ON "Customer"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_legacyId_key" ON "Quote"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_number_key" ON "Reservation"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_legacyId_key" ON "Reservation"("legacyId");

-- CreateIndex
CREATE INDEX "Reservation_pickupAt_idx" ON "Reservation"("pickupAt");

-- CreateIndex
CREATE INDEX "Reservation_status_pickupLocationId_idx" ON "Reservation"("status", "pickupLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "Rental_raNumber_key" ON "Rental"("raNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Rental_legacyId_key" ON "Rental"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Rental_reservationId_key" ON "Rental"("reservationId");

-- CreateIndex
CREATE INDEX "Rental_status_checkOutLocationId_idx" ON "Rental"("status", "checkOutLocationId");

-- CreateIndex
CREATE INDEX "Rental_expectedReturnAt_idx" ON "Rental"("expectedReturnAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingDriver_reservationId_customerId_key" ON "BookingDriver"("reservationId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingDriver_rentalId_customerId_key" ON "BookingDriver"("rentalId", "customerId");

-- CreateIndex
CREATE INDEX "ChargeLine_quoteId_idx" ON "ChargeLine"("quoteId");

-- CreateIndex
CREATE INDEX "ChargeLine_reservationId_idx" ON "ChargeLine"("reservationId");

-- CreateIndex
CREATE INDEX "ChargeLine_rentalId_idx" ON "ChargeLine"("rentalId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_legacyId_key" ON "Payment"("legacyId");

-- CreateIndex
CREATE INDEX "Payment_reservationId_idx" ON "Payment"("reservationId");

-- CreateIndex
CREATE INDEX "Payment_rentalId_idx" ON "Payment"("rentalId");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_s3Key_key" ON "Attachment"("s3Key");

-- CreateIndex
CREATE UNIQUE INDEX "RentalInvoice_invoiceNumber_key" ON "RentalInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_at_idx" ON "AuditLog"("entityType", "entityId", "at");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationHours" ADD CONSTRAINT "LocationHours_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleMake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleMake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_rentalLocationId_fkey" FOREIGN KEY ("rentalLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_owningLocationId_fkey" FOREIGN KEY ("owningLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_bodyId_fkey" FOREIGN KEY ("bodyId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_fuelTypeId_fkey" FOREIGN KEY ("fuelTypeId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_engineBrandId_fkey" FOREIGN KEY ("engineBrandId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_engineTypeId_fkey" FOREIGN KEY ("engineTypeId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleOption" ADD CONSTRAINT "VehicleOption_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleOption" ADD CONSTRAINT "VehicleOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleBlock" ADD CONSTRAINT "VehicleBlock_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleBlock" ADD CONSTRAINT "VehicleBlock_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleBlock" ADD CONSTRAINT "VehicleBlock_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateValue" ADD CONSTRAINT "RateValue_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "Rate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateValue" ADD CONSTRAINT "RateValue_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateSeason" ADD CONSTRAINT "RateSeason_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "Rate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateSeason" ADD CONSTRAINT "RateSeason_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_parentIataId_fkey" FOREIGN KEY ("parentIataId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_enteredLocationId_fkey" FOREIGN KEY ("enteredLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_primaryCustomerId_fkey" FOREIGN KEY ("primaryCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_returnLocationId_fkey" FOREIGN KEY ("returnLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "Rate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_returnLocationId_fkey" FOREIGN KEY ("returnLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "Rate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_discountReasonId_fkey" FOREIGN KEY ("discountReasonId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_dropoffLocationId_fkey" FOREIGN KEY ("dropoffLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_checkOutLocationId_fkey" FOREIGN KEY ("checkOutLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_checkInLocationId_fkey" FOREIGN KEY ("checkInLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "Rate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_discountReasonId_fkey" FOREIGN KEY ("discountReasonId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_rentalReasonId_fkey" FOREIGN KEY ("rentalReasonId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDriver" ADD CONSTRAINT "BookingDriver_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDriver" ADD CONSTRAINT "BookingDriver_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingDriver" ADD CONSTRAINT "BookingDriver_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeLine" ADD CONSTRAINT "ChargeLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeLine" ADD CONSTRAINT "ChargeLine_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeLine" ADD CONSTRAINT "ChargeLine_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeLine" ADD CONSTRAINT "ChargeLine_miscChargeId_fkey" FOREIGN KEY ("miscChargeId") REFERENCES "MiscCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeLine" ADD CONSTRAINT "ChargeLine_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalVehicleSegment" ADD CONSTRAINT "RentalVehicleSegment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalVehicleSegment" ADD CONSTRAINT "RentalVehicleSegment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficTicket" ADD CONSTRAINT "TrafficTicket_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_miscChargeId_fkey" FOREIGN KEY ("miscChargeId") REFERENCES "MiscCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adjustment" ADD CONSTRAINT "Adjustment_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillSplit" ADD CONSTRAINT "BillSplit_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillSplit" ADD CONSTRAINT "BillSplit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillSplitTax" ADD CONSTRAINT "BillSplitTax_billSplitId_fkey" FOREIGN KEY ("billSplitId") REFERENCES "BillSplit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillSplitTax" ADD CONSTRAINT "BillSplitTax_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalInvoice" ADD CONSTRAINT "RentalInvoice_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Constraints Prisma can't express. Appended to the first migration
-- (prisma migrate dev --create-only, then paste this in).

-- Prevent double-booking a vehicle: no two blocks for the same vehicle may overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "VehicleBlock"
  ADD CONSTRAINT vehicle_block_no_overlap
  EXCLUDE USING gist ("vehicleId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&);

ALTER TABLE "VehicleBlock"
  ADD CONSTRAINT vehicle_block_valid_range CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT vehicle_block_one_owner CHECK (num_nonnulls("reservationId", "rentalId") = 1);

-- A charge line belongs to exactly one of quote / reservation / rental.
ALTER TABLE "ChargeLine"
  ADD CONSTRAINT charge_line_one_owner CHECK (num_nonnulls("quoteId", "reservationId", "rentalId") = 1);

-- Additional driver belongs to exactly one of reservation / rental.
ALTER TABLE "BookingDriver"
  ADD CONSTRAINT booking_driver_one_owner CHECK (num_nonnulls("reservationId", "rentalId") = 1);

-- Pickup/drop-off belongs to exactly one of reservation / rental.
ALTER TABLE "Transport"
  ADD CONSTRAINT transport_one_owner CHECK (num_nonnulls("reservationId", "rentalId") = 1);
