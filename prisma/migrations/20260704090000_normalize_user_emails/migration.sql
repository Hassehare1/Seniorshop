-- Engångs-normalisering: e-post lagras alltid som trimmade gemener.
-- Appen normaliserar numera vid inloggning och när admin skapar/uppdaterar
-- användare — detta rättar rader som skapats innan dess.
-- (Krockar två rader efter normalisering stoppar unikindexet migrationen,
--  vilket är rätt beteende: det måste lösas manuellt, inte tyst.)
UPDATE "User" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));
