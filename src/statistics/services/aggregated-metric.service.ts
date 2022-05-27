import { DataCenterService } from '../../collector/services/data-center.service';
import { MetricType } from '../../collector/enums/metric-type.enum';
import { WeightedAverageImpl } from '../aggregations/weight-average.impl';
import { SumImpl } from '../aggregations/sum.impl';
import { MetricTypeService } from '../../collector/services/metric-type.service';
import { Region } from '../models/dtos/region.enum';
import { MetricEntityInterface } from '../../collector/entities/metric-entity.interface';
import { StorageEntityEntity } from '../../collector/entities/storage-entity.entity';

export interface RegionMetricInterface {
    region: Region;
    metrics: MetricEntityInterface[];
}

export abstract class AggregatedMetricService {
    aggregationStrategies = [
        {
            metricType: [MetricType.TOTAL_SAVING_EFFECT],
            algorithm: new WeightedAverageImpl(),
            options: {
                weightType: MetricType.PHYSICAL_CAPACITY,
                ignoreValueUnder: 1,
            },
        },
        {
            metricType: [
                MetricType.LOGICAL_CAPACITY,
                MetricType.SUBSCRIBED_CAPACITY,
                MetricType.CHANGE_MONTH,
                MetricType.PHYSICAL_CAPACITY,
                MetricType.TRANSFER,
                MetricType.WORKLOAD,
            ],
            algorithm: new SumImpl(),
            options: null,
        },
    ];
    private dataCenterMetricService: DataCenterService;
    private metricTypeService: MetricTypeService;

    protected constructor(
        dataCenteService: DataCenterService,
        metricType: MetricTypeService
    ) {
        this.dataCenterMetricService = dataCenteService;
        this.metricTypeService = metricType;
    }

    abstract getData(types: MetricType[], dataCenterIds: number[]);

    abstract fetchMetricsOnly(
        entities: StorageEntityEntity[]
    ): MetricEntityInterface[][];

    public async fetchAggregatedMetricsGrouped(
        types: MetricType[],
        regions: Region[]
    ): Promise<RegionMetricInterface[]> {
        return await Promise.all(
            regions.map(async (group) => ({
                region: group,
                metrics: await this.fetchAndAggregateMetrics(
                    types,
                    await this.dataCenterMetricService.getDataCenterIdByRegion(
                        group
                    )
                ),
            }))
        );
    }

    private async fetchAndAggregateMetrics(
        types: MetricType[],
        dataCenterIds: number[]
    ): Promise<MetricEntityInterface[]> {
        const entities = await this.getData(
            this.resolveFetchingMetricTypes(types),
            dataCenterIds
        );
        const metrics = this.fetchMetricsOnly(entities);

        return await Promise.all(
            types.map(async (type) => {
                const config = this.getStrategy(type);
                const aggValue = config.algorithm.aggregate(
                    metrics,
                    type,
                    config.options
                );
                aggValue.metricTypeEntity =
                    await this.metricTypeService.findById(type);
                return aggValue;
            })
        );
    }

    private resolveFetchingMetricTypes(types: MetricType[]): MetricType[] {
        const result = types.map((type) => type);
        types.forEach((type) => {
            const strategy = this.getStrategy(type);
            if (
                strategy.options != null &&
                strategy.options.weightType != null
            ) {
                result.push(strategy.options.weightType);
            }
        });
        return result;
    }

    private getStrategy(type: MetricType) {
        return this.aggregationStrategies.find((strategy) =>
            strategy.metricType.some((metricTypeDef) => type === metricTypeDef)
        );
    }
}
