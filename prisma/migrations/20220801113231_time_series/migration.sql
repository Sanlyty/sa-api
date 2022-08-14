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
