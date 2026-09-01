// Reglerna för vad en veckorapport får innehålla, utbrutna ur routen och
// formuläret så att de går att testa utan databas och utan inloggning.
//
// Samma regel gäller på två ställen med olika syfte: formuläret gråar ut
// kunden i rullistan så att man inte råkar välja den igen, och servern avvisar
// den om den ändå kommer in. Ligger logiken på båda ställena som handskriven
// kod glider de isär, och då spärrar UI:t något servern släpper igenom eller
// tvärtom.

import { tillaterFleraPerVecka } from "./customerTypes.ts";

type KundRef = { id: string; type: string };

/**
 * Kunderna som redan ligger på veckan och därför inte ska gå att välja igen på
 * raden `index`. Mindre försäljning undantas — se tillaterFleraPerVecka.
 *
 * Rader utan vald kund (tom sträng) räknas aldrig som upptagna: en nyss tillagd
 * tom rad skulle annars spärra hela listan.
 */
export function upptagnaKunder(
  visits: { customerId: string }[],
  index: number,
  customers: KundRef[],
): Set<string> {
  const flerTillatna = new Set(
    customers.filter(c => tillaterFleraPerVecka(c.type)).map(c => c.id),
  );
  const upptagna = new Set<string>();
  visits.forEach((v, i) => {
    if (i === index) return;
    if (!v.customerId) return;
    if (flerTillatna.has(v.customerId)) return;
    upptagna.add(v.customerId);
  });
  return upptagna;
}

/**
 * Den första kunden som förekommer två gånger i veckan utan att få göra det,
 * eller null när veckan är i sin ordning.
 *
 * Okända kund-id (sådana som inte finns i distriktet) behandlas som vanliga
 * kunder och alltså som dubbletter. Routen avvisar dem ändå tidigare med ett
 * annat fel — men att låta ett okänt id ärva undantaget vore fel väg att falla.
 */
export function forstaOtillatnaDubbletten(
  visits: { customerId: string }[],
  customers: KundRef[],
): KundRef | null {
  const perId = new Map(customers.map(c => [c.id, c]));
  const seen = new Set<string>();

  for (const v of visits) {
    const kund = perId.get(v.customerId);
    if (kund && tillaterFleraPerVecka(kund.type)) continue;
    if (seen.has(v.customerId)) return kund ?? { id: v.customerId, type: "" };
    seen.add(v.customerId);
  }
  return null;
}
