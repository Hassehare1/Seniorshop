-- Postnummer per kund, för geografisk analys av försäljningen.
--
-- Frivilligt fält: befintliga kunder saknar det tills någon fyller i det på
-- kundkortet. Lagras som enbart siffror utan mellanslag ("12345"); längden
-- följer distriktets region (5 för SE/FI, 4 för DK).
ALTER TABLE "Customer" ADD COLUMN "postalCode" TEXT;
