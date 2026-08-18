-- Övrigt finns inte i FT:s tio kategorier. Johans beslut: de hör hemma under
-- Mindre försäljning (privatperson som köper hemma hos sig).
--
-- Enum-värdet OVRIGT tas INTE bort. Aggregeringen använder det som uppsamling
-- för okända typer (aggMap[type] ?? aggMap.OVRIGT), så det måste finnas kvar.
-- Det går däremot inte längre att välja i formulär — se customerTypeOptions.

UPDATE "Customer" SET "type" = 'MINDRE_FORSALJNING' WHERE "type" = 'OVRIGT';
