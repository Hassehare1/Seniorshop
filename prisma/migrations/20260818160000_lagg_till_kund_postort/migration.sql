-- Postort som komplement till postnumret. Fri text, valfri — fylls i för hand
-- av FT precis som postnumret, eftersom portalen inte har någon uppslagstabell.
ALTER TABLE "Customer" ADD COLUMN "city" TEXT;
