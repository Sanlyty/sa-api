import { MetricType } from '../../collector/enums/metric-type.enum';
import { MetricEntityInterface } from '../../collector/entities/metric-entity.interface';
import { AggregationAlgorithmAbstract } from './aggregation-algorithm.abstract';

export class WeightedAverageImpl extends AggregationAlgorithmAbstract {
    constructor() {
        super();
    }

    aggregate(
        entities: MetricEntityInterface[][],
        metricType: MetricType,
        options: any
    ): MetricEntityInterface {
        let weightValueTotal = 0;
        let aggValueTotal = 0;

        entities.forEach((entity) => {
            const metric = this.findMetricByType(entity, metricType);

            if (metric) {
                const metricWeight = this.findMetricByType(
                    entity,
                    options.weightType
                );

                if (metric.value > options.ignoreValueUnder) {
                    aggValueTotal += metric.value * metricWeight.value;
                    weightValueTotal += metricWeight.value;
                }
            }
        });

        const value = aggValueTotal / weightValueTotal;

        return {
            value,
            metricTypeEntity: null,
            id: null,
            date: null,
        };
    }
}
