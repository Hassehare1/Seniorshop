-- Vestigialt fält: en modevisning delar aldrig upp försäljningen i två belopp
-- (all försäljning på ett modevisningsbesök ÄR modevisningsförsäljning, styrt
-- av Visit.isFashionShow). Fältet gick aldrig att fylla i via UI eller import
-- och var därför alltid 0.
ALTER TABLE "Visit" DROP COLUMN "fashionShowSales";
