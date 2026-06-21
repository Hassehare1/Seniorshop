-- Extra kundfält: kontaktroll, e-post, storlek (antal boende/medlemmar)
-- Additivt och bakåtkompatibelt: alla nullable, befintliga rader påverkas inte.
ALTER TABLE "Customer" ADD COLUMN "contactRole" TEXT;
ALTER TABLE "Customer" ADD COLUMN "email" TEXT;
ALTER TABLE "Customer" ADD COLUMN "size" INTEGER;
