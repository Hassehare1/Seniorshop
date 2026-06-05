-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FRANCHISEE');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('VARDHEM', 'FORENING', 'TRAFFPUNKT', 'BOENDE_55', 'OVRIGT');

-- CreateEnum
CREATE TYPE "SeasonType" AS ENUM ('VAR', 'HOST');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('SE', 'FI', 'DK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FRANCHISEE',
    "districtId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "region" "Region" NOT NULL DEFAULT 'SE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeConfig" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "ftFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.075,
    "mfFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "mfFeeCap" DOUBLE PRECISION NOT NULL DEFAULT 5999.812,
    "vatMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.25,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "districtId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "type" "SeasonType" NOT NULL,
    "year" INTEGER NOT NULL,
    "weekStart" INTEGER NOT NULL,
    "weekEnd" INTEGER NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "numberOfCustomers" INTEGER NOT NULL DEFAULT 0,
    "sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFashionShow" BOOLEAN NOT NULL DEFAULT false,
    "fashionShowSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ftFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mfFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mfFeeAccumulated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalToPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comment" TEXT,
    "previousYearSales" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "District_number_key" ON "District"("number");

-- CreateIndex
CREATE UNIQUE INDEX "FeeConfig_districtId_key" ON "FeeConfig"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_type_year_key" ON "Season"("type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_districtId_seasonId_week_key" ON "WeeklyReport"("districtId", "seasonId", "week");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeConfig" ADD CONSTRAINT "FeeConfig_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
