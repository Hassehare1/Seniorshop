-- FT:s egna mål per säsong (manuell input), avräknas mot utfallet på Översikt.
-- Ett mål per distrikt × säsong.
-- CreateTable
CREATE TABLE "SeasonGoal" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "salesTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "visitsTarget" INTEGER NOT NULL DEFAULT 0,
    "avgPerVisitTarget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fashionShowsTarget" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonGoal_districtId_seasonId_key" ON "SeasonGoal"("districtId", "seasonId");

-- AddForeignKey
ALTER TABLE "SeasonGoal" ADD CONSTRAINT "SeasonGoal_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonGoal" ADD CONSTRAINT "SeasonGoal_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
