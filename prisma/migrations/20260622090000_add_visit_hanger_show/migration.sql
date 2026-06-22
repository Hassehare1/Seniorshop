-- Lägg till "Visning på galge" som flagga på Visit (vid sidan av Modevisning)
-- Additivt och bakåtkompatibelt: alla befintliga besök får false automatiskt.
ALTER TABLE "Visit" ADD COLUMN "isHangerShow" BOOLEAN NOT NULL DEFAULT false;
