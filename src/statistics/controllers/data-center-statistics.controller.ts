import {
    Controller,
    Get,
    Param,
    Query,
    NotFoundException,
} from '@nestjs/common';
import { DataCenterStatisticsService } from '../services/data-center-statistics.service';
import {
    DataCenterService,
    MetricGroup,
} from '../../collector/services/data-center.service';
import { StatisticQueryParams } from './params/statistics.query-params';
import { StorageEntityTransformer } from '../../collector/transformers/storage-entity.transformer';
import { StorageEntityResponseDto } from '../../collector/dto/storage-entity-response.dto';
import { StorageEntityMetricTransformer } from '../transformers/storage-entity-metric.transformer';
import { StorageEntityFilterVo } from '../services/vos/storage-entity-filter.vo';
import { MetricFilterUtils } from '../utils/metric-filter.utils';
import { OrderByUtils } from '../utils/vo/order-by.utils';

const metricGroups = {
    performance: MetricGroup.PERFORMANCE,
    capacity: MetricGroup.CAPACITY,
    adapters: MetricGroup.ADAPTERS,
    sla: MetricGroup.SLA,
    'host-groups': MetricGroup.HOST_GROUPS,
    'parity-groups-events': MetricGroup.PARITY_GROUPS,
};

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

    @Get(':metric')
    getMetricAll(
        @Param('metric') metric: string,
        @Query() queryParams: StatisticQueryParams
    ) {
        const metricGroup = metricGroups[metric.toLowerCase()];

        if (!metricGroup) {
            throw new NotFoundException();
        }

        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            metricGroup,
            null,
            queryParams.period,
            {
                fromDate: queryParams.fromDate,
                toDate: queryParams.toDate,
            }
        );
    }

    @Get(':idDataCenter/:metric')
    getMetric(
        @Param('idDataCenter') idDataCenter: number,
        @Param('metric') metric: string,
        @Query() queryParams: StatisticQueryParams
    ) {
        const metricGroup = metricGroups[metric.toLowerCase()];

        if (!metricGroup) {
            throw new NotFoundException();
        }

        return this.dataCenterStatisticsService.getMetricByIdDataCenter(
            metricGroup,
            idDataCenter,
            queryParams.period,
            {
                fromDate: queryParams.fromDate,
                toDate: queryParams.toDate,
            }
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

        return queryParams?.output === 'FLAT'
            ? StorageEntityMetricTransformer.transformFlat(filteredResult)
            : StorageEntityMetricTransformer.transform(filteredResult);
    }
}
