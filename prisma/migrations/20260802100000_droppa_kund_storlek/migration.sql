-- Droppa Customer.size ("Storlek — antal boende/medlemmar").
--
-- Varför: fältet var skrivbart men lästes aldrig — det fylldes i via formulär
-- och kundimport, men användes inte i någon analys, beräkning eller export.
-- Kunden (FT) återkopplade att det inte fyllde någon funktion. Kommentar-fältet
-- täcker behovet av fri information om kunden.
--
-- Import: "Storlek"-kolumnen i FT:ers befintliga Excel-filer ignoreras nu tyst
-- (importen läser kolumner på rubriknamn), så gamla filer fungerar fortsatt.

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "size";
