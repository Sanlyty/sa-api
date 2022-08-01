import { Module } from '@nestjs/common';
import { DataCenterStatisticsController } from './controllers/data-center-statistics.controller';
import { DataCenterStatisticsService } from './services/data-center-statistics.service';
import { CollectorModule } from '../collector/collector.module';
import { InfrastructureStatisticsController } from './controllers/infrastructure-statistics.controller';
import { GraphDataService } from './services/graph-data.service';
import { PoolAggregatedMetricService } from './services/pool-aggregated-metric.service';
import { SystemAggregatedMetricService } from './services/system-aggregated-metric.service';
import { LatencyController } from './controllers/latency/latency.controller';
import { LatencyBlockSizeService } from './services/latency-block-size.service';
import { MaterializedViewRefresher } from './workers/materialized-view-refresher';
import { DatabaseAdminitrationService } from './services/database-adminitration.service';
import { AdminController } from './controllers/admin.controller';
import { NotificationService } from './workers/notification-service';
import { ConfigModule } from '../config/config.module';
import { StorageEntityRepository } from '../collector/repositories/storage-entity.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeSeriesService } from './workers/time-series-service';

@Module({
    controllers: [
        DataCenterStatisticsController,
        InfrastructureStatisticsController,
        LatencyController,
        AdminController,
    ],
    providers: [
        DataCenterStatisticsService,
        GraphDataService,
        PoolAggregatedMetricService,
        SystemAggregatedMetricService,
        LatencyBlockSizeService,
        MaterializedViewRefresher,
        NotificationService,
        TimeSeriesService,
        DatabaseAdminitrationService,
    ],
    imports: [
        CollectorModule,
        ConfigModule,
        TypeOrmModule.forFeature([StorageEntityRepository]),
    ],
})
export class StatisticsModule {}
