-- RentCentric Settings > Damage Setup > Damage Conditions (the values in use there)
INSERT INTO "Lookup" ("id", "kind", "name", "sortOrder", "isActive") VALUES
  ('lk_dc_broken', 'DAMAGE_CONDITION', 'Broken', 0, true),
  ('lk_dc_crack', 'DAMAGE_CONDITION', 'Crack', 1, true),
  ('lk_dc_dent', 'DAMAGE_CONDITION', 'Dent', 2, true),
  ('lk_dc_rockchip', 'DAMAGE_CONDITION', 'Rock Chip', 3, true),
  ('lk_dc_rust', 'DAMAGE_CONDITION', 'Rust', 4, true),
  ('lk_dc_scratchchip', 'DAMAGE_CONDITION', 'Scratch. Chip', 5, true)
ON CONFLICT ("kind", "name") DO NOTHING;
