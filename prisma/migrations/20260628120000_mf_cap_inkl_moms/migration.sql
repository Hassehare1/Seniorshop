-- MF-taket betyder nu 6000 kr INK moms (konverteras till ex moms i beräkningen,
-- src/lib/fees.ts). Sätt nytt default och uppdatera befintliga distrikt som
-- fortfarande har det gamla ex moms-värdet 5999.812.
ALTER TABLE "FeeConfig" ALTER COLUMN "mfFeeCap" SET DEFAULT 6000;
UPDATE "FeeConfig" SET "mfFeeCap" = 6000 WHERE "mfFeeCap" = 5999.812;
