import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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
      mfFeeCap: 5999.812,
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
    { name: "Skogsrået", type: "TRAFFPUNKT" as const },
    { name: "PRO Överum Dalhem", type: "FORENING" as const },
    { name: "Lindero", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Bryggan", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Holmsjö", type: "TRAFFPUNKT" as const },
    { name: "SPF Vimmerby", type: "FORENING" as const },
    { name: "Pro Orrefors", type: "FORENING" as const },
    { name: "Drejaren", type: "TRAFFPUNKT" as const },
    { name: "Pynten", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Trekanten", type: "TRAFFPUNKT" as const },
    { name: "Atlasvägen 2", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Påryd", type: "TRAFFPUNKT" as const },
    { name: "PRO Ljuder Skruv", type: "FORENING" as const },
    { name: "Falk Församling", type: "FORENING" as const },
    { name: "Träffpunkt St Kristoffersväg", type: "TRAFFPUNKT" as const },
    { name: "Eken", type: "FORENING" as const },
    { name: "Solbacka", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Figeholm", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Rönningegården", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Ingelstorpsvägen", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Vänskapensväg", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Kristdala", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Norra Kajen", type: "TRAFFPUNKT" as const },
    { name: "Träffpunkt Lyckeby", type: "TRAFFPUNKT" as const },
    { name: "Wasa Seaside", type: "FORENING" as const },
    { name: "Birgitta-Logen Karlskrona", type: "FORENING" as const },
    { name: "Höstglöd", type: "FORENING" as const },
    { name: "PRO Hjorted", type: "FORENING" as const },
    { name: "PRO Klintehamn", type: "FORENING" as const },
    { name: "Pjäsen", type: "VARDHEM" as const },
    { name: "Gråbo", type: "TRAFFPUNKT" as const },
    { name: "Regementsgatan", type: "VARDHEM" as const },
    { name: "Illiansgården", type: "VARDHEM" as const },
    { name: "Närheten", type: "FORENING" as const },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: `seed-${c.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `seed-${c.name.toLowerCase().replace(/\s+/g, "-")}`,
        ...c,
        districtId: district6.id,
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
