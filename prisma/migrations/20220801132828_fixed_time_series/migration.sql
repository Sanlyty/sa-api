/*
  Warnings:

  - Changed the type of `x` on the `TimeSeries` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "TimeSeries" DROP COLUMN "x",
ADD COLUMN     "x" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TimeSeries_variant_x_key" ON "TimeSeries"("variant", "x");
