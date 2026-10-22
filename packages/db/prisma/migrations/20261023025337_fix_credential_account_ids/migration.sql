-- Users added in Settings > Users had their email/password login saved with accountId = the email, so they could not
-- sign in (Better Auth looks it up by the user's id). Repair them.
UPDATE "account" SET "accountId" = "userId" WHERE "providerId" = 'credential' AND "accountId" <> "userId";
