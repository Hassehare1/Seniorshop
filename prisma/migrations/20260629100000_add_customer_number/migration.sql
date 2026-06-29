-- Kundnummer: löpnummer per distrikt (visas som D{distriktsnr}-{customerNumber}).
-- 1) Lägg kolumn (tillfälligt nullbar). 2) Backfill: numrera befintliga kunder
-- löpande per distrikt, ordnat på skapelsedatum + namn. 3) Gör NOT NULL.
-- 4) Unik per distrikt.
ALTER TABLE "Customer" ADD COLUMN "customerNumber" INTEGER;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "districtId" ORDER BY "createdAt", "name") AS rn
  FROM "Customer"
)
UPDATE "Customer" c SET "customerNumber" = n.rn FROM numbered n WHERE c.id = n.id;

ALTER TABLE "Customer" ALTER COLUMN "customerNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Customer_districtId_customerNumber_key" ON "Customer"("districtId", "customerNumber");
