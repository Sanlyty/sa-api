-- AlterTable
ALTER TABLE "parity_group_metrics" ADD CONSTRAINT "parity_group_metrics_pkey" PRIMARY KEY ("id_metric");

-- CreateTable
CREATE TABLE "TimeSeries" (
    "id" SERIAL NOT NULL,
    "variant" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TimeSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimeSeries_variant_x_key" ON "TimeSeries"("variant", "x");
