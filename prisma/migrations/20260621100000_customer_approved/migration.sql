-- Godkänn-status på kund: FT lägger till (false), admin godkänner (true).
-- Befintliga kunder backfillas som godkända (de fanns före granskningsflödet).
ALTER TABLE "Customer" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Customer" SET "approved" = true;
