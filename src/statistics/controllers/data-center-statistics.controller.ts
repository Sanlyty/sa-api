import { Controller, Get, Param, Query } from '@nestjs/common';
import { DataCenterStatisticsService } from '../services/data-center-statistics.service';
import {
    DataCenterService,
    MetricGroup,
} from '../../collector/services/data-center.service';
import { StatisticParams } from './params/statistic.params';
import {
    OutputType,
    StatisticQueryParams,
} from './params/statistics.query-params';
import { StorageEntityTransformer } from '../../collector/transformers/storage-entity.transformer';
import { StorageEntityResponseDto } from '../../collector/dto/storage-entity-response.dto';
import { StorageEntityMetricTransformer } from '../transformers/storage-entity-metric.transformer';
import { StorageEntityFilterVo } from '../services/vos/storage-entity-filter.vo';
import { MetricFilterUtils } from '../utils/metric-filter.utils';
import { OrderByUtils } from '../utils/vo/order-by.utils';

@Controller('api/v1/datacenters')
export class DataCenterStatisticsController {
    constructor(
        private dataCenterStatisticsService: DataCenterStatisticsService,
        private dataCenterService: DataCenterService
    ) {}

    @Get('/')
    async infrastructureMap(): Promise<StorageEntityResponseDto[]> {
        const entities = await this.dataCenterService.getAllDataCenters();
        return StorageEntityTransformer.transformAll(entities, true, true);
    }

    @Get('performance')
    performanceStatisticsAll(@Query() queryParams: StatisticQueryParams) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.PERFORMANCE,
            null,
            queryParams.period
        );
    }

    @Get(':idDataCenter/performance')
    performanceStatistics(
        @Param('idDataCenter') idDataCenter: number,
        @Query() queryParams: StatisticQueryParams
    ) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.PERFORMANCE,
            idDataCenter,
            queryParams.period
        );
    }

    @Get('capacity')
    capacityStatisticsAll(@Query() queryParams: StatisticQueryParams) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.CAPACITY
        );
    }

    @Get(':idDataCenter/capacity')
    capacityStatistics(
        @Param('idDataCenter') idDataCenter: number,
        @Query() queryParams: StatisticQueryParams
    ) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.CAPACITY,
            idDataCenter
        );
    }

    @Get('adapters')
    channelAdaptersStatisticsAll(
        @Param() params: StatisticParams,
        @Query() queryParams: StatisticQueryParams
    ) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.ADAPTERS,
            null,
            queryParams.period
        );
    }

    @Get(':idDataCenter/adapters')
    channelAdaptersStatistics(
        @Param('idDataCenter') idDataCenter: number,
        @Query() queryParams: StatisticQueryParams
    ) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.ADAPTERS,
            idDataCenter,
            queryParams.period
        );
    }

    @Get('sla')
    slaStatisticsAll(@Query() queryParams: StatisticQueryParams) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.SLA,
            null,
            queryParams.period
        );
    }

    @Get(':idDataCenter/sla')
    slaStatistics(
        @Param('idDataCenter') idDataCenter: number,
        @Query() queryParams: StatisticQueryParams
    ) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.SLA,
            idDataCenter,
            queryParams.period
        );
    }

    @Get('host-groups')
    hostGroupStatisticsAll(@Query() queryParams: StatisticQueryParams) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.HOST_GROUPS
        );
    }

    @Get(':idDataCenter/host-groups')
    hostGroupStatistics(
        @Param('idDataCenter') idDataCenter: number,
        @Query() queryParams: StatisticQueryParams
    ) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.HOST_GROUPS,
            idDataCenter
        );
    }

    @Get('parity-groups/events')
    parityGroupEventsAll(@Query() queryParams: StatisticParams) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.PARITY_GROUPS,
            null,
            null,
            queryParams
        );
    }

    @Get(':idDataCenter/parity-groups/events')
    parityGroupEvents(
        @Param('idDataCenter') idDataCenter: number,
        @Query() params: StatisticParams
    ) {
        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            MetricGroup.PARITY_GROUPS,
            idDataCenter,
            null,
            params
        );
    }

    @Get('pools')
    async getPools(@Query() queryParams: StatisticQueryParams) {
        const filter = new StorageEntityFilterVo();
        filter.metricFilter = MetricFilterUtils.parseMetricFilter(
            queryParams.metricFilter || []
        );
        filter.referenceIds = queryParams.referenceId || [];
        filter.tiers = queryParams.tier || [];
        filter.orderBy = OrderByUtils.parseOrderBy(queryParams.orderBy || []);

        const filteredResult = await this.dataCenterService.getPoolMetricsByFilter(
            filter,
            queryParams.output
        );
        return this.isFlatOutput(queryParams)
            ? StorageEntityMetricTransformer.transformFlat(filteredResult)
            : StorageEntityMetricTransformer.transform(filteredResult);
    }

    isFlatOutput(queryParams: StatisticQueryParams) {
        return queryParams?.output === 'FLAT';
    }
}
