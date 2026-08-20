-- Säljmaterial per kund. Additiva kolumner med default: befintliga kunder får
-- noll affischer och inget digitalt, och kod som inte känner till dem påverkas inte.
ALTER TABLE "Customer" ADD COLUMN "postersA3" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN "postersA4" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN "digitalMaterial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN "digitalMaterialNote" TEXT;
