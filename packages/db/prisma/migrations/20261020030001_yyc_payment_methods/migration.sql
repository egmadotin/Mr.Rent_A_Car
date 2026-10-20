-- RentCentric Settings > Payment Methods: YYC's own methods (seen on its End Rental payment list)
INSERT INTO "LocationPaymentMethod" ("id", "locationId", "name", "isCreditCard", "isDefault", "mobileAgentIncluded", "isActive")
SELECT v.id, 'loc_yyc', v.name, false, false, false, true
FROM (VALUES ('lpm_yyc_cheque', 'Cheque'), ('lpm_yyc_directbill', 'Direct Bill Company')) AS v(id, name)
WHERE EXISTS (SELECT 1 FROM "Location" WHERE "id" = 'loc_yyc')
ON CONFLICT ("locationId", "name") DO NOTHING;
