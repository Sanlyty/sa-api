import { FilterOperator, FilterVo } from '../../collector/services/filter.vo';
import { MetricType } from '../../collector/enums/metric-type.enum';
import { MetricFilterError } from '../services/metric-filter.error';

export class MetricFilterUtils {
    public static parseMetricFilter(filter: string[]): FilterVo[] {
        return filter.map((filterItem) => this.parseFilterItem(filterItem));
    }

    private static parseFilterItem(filterItem: string) {
        const result = Object.keys(FilterOperator)
            .filter(
                (operator) =>
                    filterItem.split(FilterOperator[operator]).length === 2
            )
            .map((operator) => {
                const filter = this.splitItemByOperator(
                    filterItem,
                    FilterOperator[operator]
                );
                if (filter != null) {
                    return filter;
                }
            });
        if (result.length === 1) {
            return result[0];
        }
        return null;
    }

    private static splitItemByOperator(
        filterItem: string,
        splitter: FilterOperator
    ): FilterVo {
        const splittedItem = filterItem.split(splitter);
        if (splittedItem.length === 2) {
            const metricType = MetricType[splittedItem[0]];
            if (metricType === undefined) {
                throw new MetricFilterError(
                    `Unrecognized '${splittedItem[0]}' as metric.`
                );
            }
            return {
                type: metricType,
                operator: splitter,
                value: splittedItem[1],
            } as FilterVo;
        }
    }
}
