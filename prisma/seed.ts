import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // OBS: "ft123" är kortare än LOSENORD_MIN (lib/losenordskrav.ts) och skulle
  // inte gå att sätta genom formuläret. Det är avsiktligt kvar — seeden
  // skriver hashen direkt och passerar aldrig valideringen, lösenordet är
  // dokumenterat i README och används bara lokalt. Ändra det inte i tron att
  // det är en miss.
  const adminHash = await bcrypt.hash("admin123", 10);
  const ftHash = await bcrypt.hash("ft123", 10);

  const district6 = await prisma.district.upsert({
    where: { number: 6 },
    update: {},
    create: { number: 6, name: "Distrikt 6 – Småland", region: "SE" },
  });

  await prisma.feeConfig.upsert({
    where: { districtId: district6.id },
    update: {},
    create: {
      districtId: district6.id,
      ftFeePercent: 0.075,
      mfFeePercent: 0.01,
      mfFeeCap: 6000,
      vatMultiplier: 1.25,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@seniorshop.se" },
    update: {},
    create: {
      email: "admin@seniorshop.se",
      name: "Admin",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "ft6@seniorshop.se" },
    update: {},
    create: {
      email: "ft6@seniorshop.se",
      name: "Franchisetagare D6",
      passwordHash: ftHash,
      role: "FRANCHISEE",
      districtId: district6.id,
    },
  });

  const season = await prisma.season.upsert({
    where: { type_year: { type: "VAR", year: 2026 } },
    update: {},
    create: { type: "VAR", year: 2026, weekStart: 5, weekEnd: 26 },
  });

  const customers = [
    { name: "Skogsrået", type: "TRAFFPUNKTER" as const },
    { name: "PRO Överum Dalhem", type: "OVRIGA_FORENINGAR" as const },
    { name: "Lindero", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Bryggan", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Holmsjö", type: "TRAFFPUNKTER" as const },
    { name: "SPF Vimmerby", type: "OVRIGA_FORENINGAR" as const },
    { name: "Pro Orrefors", type: "OVRIGA_FORENINGAR" as const },
    { name: "Drejaren", type: "TRAFFPUNKTER" as const },
    { name: "Pynten", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Trekanten", type: "TRAFFPUNKTER" as const },
    { name: "Atlasvägen 2", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Påryd", type: "TRAFFPUNKTER" as const },
    { name: "PRO Ljuder Skruv", type: "OVRIGA_FORENINGAR" as const },
    { name: "Falk Församling", type: "OVRIGA_FORENINGAR" as const },
    { name: "Träffpunkt St Kristoffersväg", type: "TRAFFPUNKTER" as const },
    { name: "Eken", type: "OVRIGA_FORENINGAR" as const },
    { name: "Solbacka", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Figeholm", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Rönningegården", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Ingelstorpsvägen", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Vänskapensväg", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Kristdala", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Norra Kajen", type: "TRAFFPUNKTER" as const },
    { name: "Träffpunkt Lyckeby", type: "TRAFFPUNKTER" as const },
    { name: "Wasa Seaside", type: "OVRIGA_FORENINGAR" as const },
    { name: "Birgitta-Logen Karlskrona", type: "OVRIGA_FORENINGAR" as const },
    { name: "Höstglöd", type: "OVRIGA_FORENINGAR" as const },
    { name: "PRO Hjorted", type: "OVRIGA_FORENINGAR" as const },
    { name: "PRO Klintehamn", type: "OVRIGA_FORENINGAR" as const },
    { name: "Pjäsen", type: "ALDREBOENDE" as const },
    { name: "Gråbo", type: "TRAFFPUNKTER" as const },
    { name: "Regementsgatan", type: "ALDREBOENDE" as const },
    { name: "Illiansgården", type: "ALDREBOENDE" as const },
    { name: "Närheten", type: "OVRIGA_FORENINGAR" as const },
  ];

  let nr = 1;
  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: `seed-${c.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `seed-${c.name.toLowerCase().replace(/\s+/g, "-")}`,
        ...c,
        districtId: district6.id,
        customerNumber: nr++,
      },
    });
  }

  console.log("Seed klar!");
  console.log("Admin: admin@seniorshop.se / admin123");
  console.log("FT:    ft6@seniorshop.se / ft123");
  console.log(`Säsong: Vår 2026, id: ${season.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
