-- REA-besök på Visit. Additiv kolumn med default: befintliga besök blir
-- ordinarie, och kod som inte känner till kolumnen påverkas inte.
ALTER TABLE "Visit" ADD COLUMN "isSale" BOOLEAN NOT NULL DEFAULT false;
