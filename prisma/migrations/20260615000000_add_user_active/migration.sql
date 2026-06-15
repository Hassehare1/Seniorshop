-- Lägg till active-flagga på User (för att kunna spärra konton)
-- Additivt och bakåtkompatibelt: alla befintliga rader får true automatiskt.
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
