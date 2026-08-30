/**
 * Lösenordets minsta längd — ETT ställe, läst av både server och klient.
 *
 * Åtta tecken följer NIST SP 800-63B. Portalen låg tidigare på sex, vilket
 * var under den nivån; höjt 2026-08-30 på Johans beslut.
 *
 * Regeln gäller bara när ett lösenord SÄTTS. Inloggningen kontrollerar aldrig
 * längd, så befintliga konton med kortare lösenord fortsätter fungera — de
 * möter kravet först nästa gång lösenordet byts. Det är avsiktligt: att låsa
 * ute franchisetagare mitt i säsongen vore en sämre affär än ett kort
 * lösenord som redan finns.
 *
 * EGEN FIL och inte en konstant i lib/validering.ts, av ett konkret skäl:
 * validering.ts utvärderar zod-scheman på modulnivå, så ett klientkomponent
 * som importerade konstanten därifrån hade dragit in hela zod i webbläsarens
 * paket. Den här filen har inga beroenden alls.
 */
export const LOSENORD_MIN = 8;

/** Samma krav som text, för platshållare och hjälptexter i formulären. */
export const LOSENORD_HINT = `Minst ${LOSENORD_MIN} tecken`;
