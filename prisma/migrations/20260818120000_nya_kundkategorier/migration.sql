-- Kundkategorierna följer FT:s indelning i slutrapporten och går från 6 till 11.
--
-- Kartläggning av befintliga rader:
--   VARDHEM              -> ALDREBOENDE          (samma sak, FT:s ord)
--   TRAFFPUNKT           -> TRAFFPUNKTER
--   BOENDE_55            -> PLUS_55
--   STOD_HALSOSAMVERKAN  -> FORENING_STOD_HALSA
--   FORENING             -> OVRIGA_FORENINGAR    (se nedan)
--   OVRIGT               -> OVRIGT
--
-- FORENING är den enda tvetydiga: den kan i den nya indelningen vara antingen
-- Pensionärsförening eller Övriga föreningar. Vi väljer Övriga föreningar
-- eftersom det bevarar mer sanning än Övrigt — det ÄR en förening, vi vet bara
-- inte vilken sort. Admin får finjustera i Alla kunder; kundtypsdialogen där
-- varnar om att ändringen gäller bakåt i tiden.

CREATE TYPE "CustomerType_new" AS ENUM (
  'ALDREBOENDE',
  'TRAFFPUNKTER',
  'PENSIONARSFORENING',
  'FORENING_STOD_HALSA',
  'OVRIGA_FORENINGAR',
  'FORSAMLINGSHEM',
  'PLUS_55',
  'EGET_ARRANGEMANG',
  'CAMPINGPLATSER',
  'MINDRE_FORSALJNING',
  'OVRIGT'
);

ALTER TABLE "Customer"
  ALTER COLUMN "type" TYPE "CustomerType_new"
  USING (
    CASE "type"::text
      WHEN 'VARDHEM'             THEN 'ALDREBOENDE'
      WHEN 'TRAFFPUNKT'          THEN 'TRAFFPUNKTER'
      WHEN 'BOENDE_55'           THEN 'PLUS_55'
      WHEN 'STOD_HALSOSAMVERKAN' THEN 'FORENING_STOD_HALSA'
      WHEN 'FORENING'            THEN 'OVRIGA_FORENINGAR'
      ELSE 'OVRIGT'
    END
  )::"CustomerType_new";

DROP TYPE "CustomerType";
ALTER TYPE "CustomerType_new" RENAME TO "CustomerType";
