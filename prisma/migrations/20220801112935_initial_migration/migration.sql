-- CreateTable
CREATE TABLE "block_size_latency" (
    "id_metric" SERIAL NOT NULL,
    "id_cat_metric_type" INTEGER NOT NULL,
    "id_storage_entity" INTEGER NOT NULL,
    "id_cat_operation" INTEGER NOT NULL,
    "block_size" DOUBLE PRECISION NOT NULL,
    "latency" DOUBLE PRECISION NOT NULL,
    "value" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_size_latency_pkey" PRIMARY KEY ("id_metric")
);

-- CreateTable
CREATE TABLE "cat_component_status" (
    "id_cat_component_status" SMALLINT NOT NULL,
    "name" VARCHAR(15) NOT NULL,

    CONSTRAINT "cat_component_status_pkey" PRIMARY KEY ("id_cat_component_status")
);

-- CreateTable
CREATE TABLE "cat_external_type" (
    "id_cat_external_type" SERIAL NOT NULL,
    "name" VARCHAR(20),

    CONSTRAINT "cat_external_type_pkey" PRIMARY KEY ("id_cat_external_type")
);

-- CreateTable
CREATE TABLE "cat_metric_group" (
    "id_cat_metric_group" SERIAL NOT NULL,
    "name" VARCHAR(30) NOT NULL,

    CONSTRAINT "cat_metric_group_pkey" PRIMARY KEY ("id_cat_metric_group")
);

-- CreateTable
CREATE TABLE "cat_metric_type" (
    "id_cat_metric_type" SMALLSERIAL NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "unit" VARCHAR(10),
    "id_cat_metric_group" INTEGER NOT NULL,

    CONSTRAINT "cat_metric_type_pkey" PRIMARY KEY ("id_cat_metric_type")
);

-- CreateTable
CREATE TABLE "cat_operation" (
    "id_cat_operation" SERIAL NOT NULL,
    "name" VARCHAR(10),

    CONSTRAINT "cat_operation_pkey" PRIMARY KEY ("id_cat_operation")
);

-- CreateTable
CREATE TABLE "cat_storage_entity_type" (
    "id_cat_storage_entity_type" SMALLINT NOT NULL,
    "name" VARCHAR(20),

    CONSTRAINT "cat_storage_entity_type_pkey" PRIMARY KEY ("id_cat_storage_entity_type")
);

-- CreateTable
CREATE TABLE "cha_metrics" (
    "id_metric" SERIAL NOT NULL,
    "id_cat_metric_type" SMALLINT NOT NULL,
    "id_storage_entity" INTEGER NOT NULL,
    "value" DOUBLE PRECISION,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cha_metrics_pkey" PRIMARY KEY ("id_metric")
);

-- CreateTable
CREATE TABLE "externals" (
    "id_external" SERIAL NOT NULL,
    "id_cat_external_type" INTEGER,
    "value" VARCHAR(50),
    "id_storage_entity" INTEGER,

    CONSTRAINT "externals_pkey" PRIMARY KEY ("id_external")
);

-- CreateTable
CREATE TABLE "host_group_metrics" (
    "id_metric" SERIAL NOT NULL,
    "id_cat_metric_type" SMALLINT NOT NULL,
    "id_storage_entity" INTEGER NOT NULL,
    "value" DOUBLE PRECISION,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_group_metrics_pkey" PRIMARY KEY ("id_metric")
);

-- CreateTable
CREATE TABLE "metric_thresholds" (
    "id_metric_threshold" SERIAL NOT NULL,
    "id_cat_metric_type" SMALLINT,
    "min_value" DOUBLE PRECISION,
    "max_value" DOUBLE PRECISION,

    CONSTRAINT "metric_thresholds_pkey" PRIMARY KEY ("id_metric_threshold")
);

-- CreateTable
CREATE TABLE "migration_schema" (
    "id" SERIAL NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "name" VARCHAR NOT NULL,

    CONSTRAINT "PK_bb30f6fc0e64e58714313844dc3" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migrations" (
    "id" SERIAL NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "name" VARCHAR NOT NULL,

    CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parity_group_metrics" (
    "id_metric" SERIAL NOT NULL,
    "id_cat_metric_type" SMALLINT,
    "value" DOUBLE PRECISION,
    "peak" DOUBLE PRECISION,
    "id_storage_entity" INTEGER,
    "start_time" TIMESTAMP(6),
    "end_time" TIMESTAMP(6),

    CONSTRAINT "parity_group_metrics_pkey" PRIMARY KEY ("id_metric")
);

-- CreateTable
CREATE TABLE "pool_metrics" (
    "id_metric" SERIAL NOT NULL,
    "id_cat_metric_type" SMALLINT NOT NULL,
    "id_storage_entity" INTEGER NOT NULL,
    "value" DOUBLE PRECISION,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pool_metrics_pkey" PRIMARY KEY ("id_metric")
);

-- CreateTable
CREATE TABLE "port_metrics" (
    "id_metric" SERIAL NOT NULL,
    "id_cat_metric_type" SMALLINT NOT NULL,
    "id_storage_entity" INTEGER NOT NULL,
    "value" DOUBLE PRECISION,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "port_metrics_pkey" PRIMARY KEY ("id_metric")
);

-- CreateTable
CREATE TABLE "storage_entities" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100),
    "serial_number" VARCHAR(30),
    "parentId" INTEGER,
    "id_cat_storage_entity_status" SMALLINT NOT NULL DEFAULT 1,
    "id_cat_storage_entity_type" SMALLINT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_entities_closure" (
    "id_ancestor" INTEGER NOT NULL,
    "id_descendant" INTEGER NOT NULL,

    CONSTRAINT "storage_entities_closure_pkey" PRIMARY KEY ("id_ancestor","id_descendant")
);

-- CreateTable
CREATE TABLE "storage_entity_details" (
    "id_storage_entity" INTEGER NOT NULL,
    "model" VARCHAR(15),
    "prefix_reference_id" VARCHAR(10),
    "dkc" VARCHAR(30),
    "management_ip" VARCHAR(20),
    "rack" VARCHAR(32),
    "room" VARCHAR(32),
    "sort_id" SMALLINT,
    "speed" INTEGER,
    "note" VARCHAR(255),
    "cables" VARCHAR(50),
    "switch" VARCHAR(30),
    "slot" VARCHAR(30),
    "wwn" VARCHAR(100),

    CONSTRAINT "system_details_pkey" PRIMARY KEY ("id_storage_entity")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id_metric" SERIAL NOT NULL,
    "id_cat_metric_type" SMALLINT NOT NULL,
    "value" DOUBLE PRECISION,
    "peak" DOUBLE PRECISION,
    "id_storage_entity" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id_metric")
);

-- CreateTable
CREATE TABLE "typeorm_metadata" (
    "type" VARCHAR NOT NULL,
    "database" VARCHAR,
    "schema" VARCHAR,
    "table" VARCHAR,
    "name" VARCHAR,
    "value" TEXT
);

-- CreateIndex
CREATE INDEX "idx_cha_metrics_date" ON "cha_metrics"("id_storage_entity", "id_cat_metric_type", "date" DESC);

-- CreateIndex
CREATE INDEX "idx_cha_metrics_id_cha_metric_type" ON "cha_metrics"("id_storage_entity", "id_cat_metric_type", "id_metric");

-- CreateIndex
CREATE INDEX "idx_host_group_metrics_date" ON "host_group_metrics"("id_storage_entity", "id_cat_metric_type", "date" DESC);

-- CreateIndex
CREATE INDEX "idx_host_group_metrics_id_cha_metric_type" ON "host_group_metrics"("id_storage_entity", "id_cat_metric_type", "id_metric");

-- CreateIndex
CREATE INDEX "idx_pool_metrics_date" ON "pool_metrics"("id_storage_entity", "id_cat_metric_type", "date" DESC);

-- CreateIndex
CREATE INDEX "idx_pool_metrics_id_pool_metric_type" ON "pool_metrics"("id_storage_entity", "id_cat_metric_type", "id_metric");

-- CreateIndex
CREATE INDEX "idx_port_metrics_date" ON "port_metrics"("id_storage_entity", "id_cat_metric_type", "date" DESC);

-- CreateIndex
CREATE INDEX "idx_port_metrics_id_metric_type" ON "port_metrics"("id_storage_entity", "id_cat_metric_type", "id_metric");

-- CreateIndex
CREATE UNIQUE INDEX "ix_id_storage_entity" ON "storage_entity_details"("id_storage_entity");

-- CreateIndex
CREATE INDEX "idx_system_metrics_date" ON "system_metrics"("id_storage_entity", "id_cat_metric_type", "date" DESC);

-- CreateIndex
CREATE INDEX "idx_system_metrics_id_cat_metric_type" ON "system_metrics"("id_storage_entity", "id_cat_metric_type", "id_metric");

-- AddForeignKey
ALTER TABLE "block_size_latency" ADD CONSTRAINT "block_size_latency_id_cat_metric_type_fkey" FOREIGN KEY ("id_cat_metric_type") REFERENCES "cat_metric_type"("id_cat_metric_type") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "block_size_latency" ADD CONSTRAINT "block_size_latency_id_cat_operation_fkey" FOREIGN KEY ("id_cat_operation") REFERENCES "cat_operation"("id_cat_operation") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "block_size_latency" ADD CONSTRAINT "block_size_latency_id_storage_entity_fkey" FOREIGN KEY ("id_storage_entity") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cat_metric_type" ADD CONSTRAINT "cat_metric_type_id_cat_metric_group_fkey" FOREIGN KEY ("id_cat_metric_group") REFERENCES "cat_metric_group"("id_cat_metric_group") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cha_metrics" ADD CONSTRAINT "cha_metrics_id_cat_metric_type_fkey" FOREIGN KEY ("id_cat_metric_type") REFERENCES "cat_metric_type"("id_cat_metric_type") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cha_metrics" ADD CONSTRAINT "cha_metrics_id_storage_entity_fkey" FOREIGN KEY ("id_storage_entity") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "externals" ADD CONSTRAINT "externals_id_cat_external_type_fkey" FOREIGN KEY ("id_cat_external_type") REFERENCES "cat_external_type"("id_cat_external_type") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "externals" ADD CONSTRAINT "externals_id_storage_entity_fkey" FOREIGN KEY ("id_storage_entity") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "host_group_metrics" ADD CONSTRAINT "host_group_metrics_id_cat_metric_type_fkey" FOREIGN KEY ("id_cat_metric_type") REFERENCES "cat_metric_type"("id_cat_metric_type") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "host_group_metrics" ADD CONSTRAINT "host_group_metrics_id_storage_entity_fkey" FOREIGN KEY ("id_storage_entity") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "metric_thresholds" ADD CONSTRAINT "metric_thresholds_id_cat_metric_type_fkey" FOREIGN KEY ("id_cat_metric_type") REFERENCES "cat_metric_type"("id_cat_metric_type") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "parity_group_metrics" ADD CONSTRAINT "parity_group_metrics_id_cat_metric_type_fkey" FOREIGN KEY ("id_cat_metric_type") REFERENCES "cat_metric_type"("id_cat_metric_type") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "parity_group_metrics" ADD CONSTRAINT "parity_group_metrics_id_storage_entity_fkey" FOREIGN KEY ("id_storage_entity") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pool_metrics" ADD CONSTRAINT "pool_metrics_id_cat_metric_type_fkey" FOREIGN KEY ("id_cat_metric_type") REFERENCES "cat_metric_type"("id_cat_metric_type") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pool_metrics" ADD CONSTRAINT "pool_metrics_id_storage_entity_fkey" FOREIGN KEY ("id_storage_entity") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "port_metrics" ADD CONSTRAINT "port_metrics_id_cat_metric_type_fkey" FOREIGN KEY ("id_cat_metric_type") REFERENCES "cat_metric_type"("id_cat_metric_type") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "port_metrics" ADD CONSTRAINT "port_metrics_id_storage_entity_fkey" FOREIGN KEY ("id_storage_entity") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "storage_entities" ADD CONSTRAINT "storage_entities_id_cat_storage_entity_status_fkey" FOREIGN KEY ("id_cat_storage_entity_status") REFERENCES "cat_component_status"("id_cat_component_status") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "storage_entities" ADD CONSTRAINT "storage_entities_id_cat_storage_entity_type_fkey" FOREIGN KEY ("id_cat_storage_entity_type") REFERENCES "cat_storage_entity_type"("id_cat_storage_entity_type") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "storage_entities" ADD CONSTRAINT "storage_entities_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "storage_entities_closure" ADD CONSTRAINT "storage_entities_closure_id_ancestor_fkey" FOREIGN KEY ("id_ancestor") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "storage_entities_closure" ADD CONSTRAINT "storage_entities_closure_id_descendant_fkey" FOREIGN KEY ("id_descendant") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "storage_entity_details" ADD CONSTRAINT "system_details_id_storage_entity_fkey" FOREIGN KEY ("id_storage_entity") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "system_metrics" ADD CONSTRAINT "system_metrics_id_cat_metric_type_fkey" FOREIGN KEY ("id_cat_metric_type") REFERENCES "cat_metric_type"("id_cat_metric_type") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "system_metrics" ADD CONSTRAINT "system_metrics_id_storage_entity_fkey" FOREIGN KEY ("id_storage_entity") REFERENCES "storage_entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
