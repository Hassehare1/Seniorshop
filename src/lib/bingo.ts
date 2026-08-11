// Replikerna som Modevisningsbingo plockar ur.
//
// Listan är medvetet en enkel array — det är FT som vet vad som faktiskt sägs
// på en visning, så den här ska vara lätt att stryka i och fylla på.
// Håll dem korta: de sätts i 36 px och ska rymmas på två rader i en telefon.
export const BINGO_LINES: readonly string[] = [
  "Fickor!",
  "Har ni den i blått?",
  "Är den maskintvätt?",
  "Sån hade jag på 60-talet",
  "Nej men vad billigt!",
  "Nej men vad dyrt!",
  "Finns den i större?",
  "Jag har inget att ha den till",
  "Jag ska bara känna på tyget",
  "Passar den till det svarta?",
  "Är det äkta ull?",
  "Kan man stryka den?",
  "Den där hade min mamma",
  "Den är för kort",
  "Nu blev det kaffe",
  "Var är mina glasögon?",
];

// Antal stämplar som ger bingo.
export const HITS_TO_WIN = 5;
