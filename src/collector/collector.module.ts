import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemMetricEntity } from './entities/system-metric.entity';
import { SystemMetricService } from './services/system-metric.service';
import { CatMetricTypeEntity } from './entities/cat-metric-type.entity';
import { PoolMetricEntity } from './entities/pool-metric.entity';
import { PoolMetricService } from './services/pool-metric.service';
import { ChaMetricService } from './services/cha-metric.service';
import { ChaMetricEntity } from './entities/cha-metric.entity';
import { DataCenterService } from './services/data-center.service';
import { MetricTypeService } from './services/metric-type.service';
import { CapacityStatisticsService } from './services/capacity-statistics.service';
import { MetricController } from './controllers/metric.controller';
import { HostGroupMetricEntity } from './entities/host-group-metric.entity';
import { SystemMetricReadEntity } from './entities/system-metric-read.entity';
import { PoolMetricReadEntity } from './entities/pool-metric-read.entity';
import { ChaMetricReadEntity } from './entities/cha-metric-read.entity';
import { PortMetricService } from './services/port-metric.service';
import { PortMetricEntity } from './entities/port-metric.entity';
import { PortMetricReadEntity } from './entities/port-metric-read.entity';
import { CatExternalTypeEntity } from './entities/cat-external-type.entity';
import { ExternalEntity } from './entities/external.entity';
import { ExternalService } from './services/external.service';
import { ExternalTypeService } from './services/external-type.service';
import { ExternalController } from './controllers/external.controller';
import { LatencyMetricTransformer } from './transformers/latency-metric.transformer';
import { LatencyEntity } from './entities/latency.entity';
import { LatencyMetricService } from './services/latency-metric.service';
import { OperationService } from './services/operation.service';
import { CatOperationEntity } from './entities/cat-operation.entity';
import { StorageEntityController } from './controllers/v2/storage-entity.controller';
import { StorageEntityService } from './services/storage-entity.service';
import { StorageEntityEntity } from './entities/storage-entity.entity';
import { StorageEntityRepository } from './repositories/storage-entity.repository';
import { MetricCollectorService } from './services/collect/metric-collector.service';
import { MetricRepositoryFactory } from './factory/metric-repository.factory';
import { MultiValueMetricCollectorService } from './services/collect/multi-value-metric-collector.service';
import { SystemDetailsService } from './services/system-details.service';
import { StorageEntityDetailsEntity } from './entities/storage-entity-details.entity';
import { ParityGroupMetricEntity } from './entities/parity-group-metric.entity';
import { PgMultiValueMetricCollectorService } from './services/collect/pg-multi-value-metric-collector.service';
import { MaintainerService } from './services/maintainer.service';
import { CompatibilityController } from './controllers/compat.controller';
import { MaintainerCacheService } from './services/maintainer-cache.service';
import { ConfigModule } from '../config/config.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            SystemMetricEntity,
            SystemMetricReadEntity,
            CatMetricTypeEntity,
            PoolMetricEntity,
            PoolMetricReadEntity,
            ChaMetricEntity,
            ChaMetricReadEntity,
            HostGroupMetricEntity,
            PortMetricEntity,
            PortMetricReadEntity,
            CatExternalTypeEntity,
            ExternalEntity,
            LatencyEntity,
            CatOperationEntity,
            StorageEntityEntity,
            StorageEntityDetailsEntity,
            ParityGroupMetricEntity,
            /**
             * Custom repositories
             */
            StorageEntityRepository,
        ]),
        HttpModule,
        ConfigModule,
    ],
    providers: [
        PoolMetricService,
        SystemMetricService,
        ChaMetricService,
        DataCenterService,
        MetricTypeService,
        CapacityStatisticsService,
        PortMetricService,
        LatencyMetricTransformer,
        DataCenterService,
        MaintainerCacheService,
        ExternalService,
        ExternalTypeService,
        LatencyMetricService,
        OperationService,
        StorageEntityService,
        MetricCollectorService,
        MetricRepositoryFactory,
        MultiValueMetricCollectorService,
        PgMultiValueMetricCollectorService,
        SystemDetailsService,
        MaintainerService,
    ],
    controllers: [
        MetricController,
        ExternalController,
        StorageEntityController,
        CompatibilityController,
    ],
    exports: [
        DataCenterService,
        CapacityStatisticsService,
        ChaMetricService,
        PoolMetricService,
        PortMetricService,
        SystemMetricService,
        DataCenterService,
        MetricTypeService,
        LatencyMetricService,
        StorageEntityService,
        MaintainerService,
    ],
})
export class CollectorModule {}
