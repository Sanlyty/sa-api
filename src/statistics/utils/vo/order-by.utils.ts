import { OrderByVo } from './order-by.vo';
import { MetricFilterError } from '../../services/metric-filter.error';
import { MetricType } from '../../../collector/enums/metric-type.enum';
import { OrderByDirection } from '../sort-storage-entity-by-metric.utils';

export class OrderByUtils {
    private static specialOrderBy = ['TIER', 'NAME', 'REFERENCE_ID'];

    public static parseOrderBy(orderBy: string[]): OrderByVo[] {
        return orderBy.map((orderByItem) => this.parseOrderByItem(orderByItem));
    }

    private static split(orderByItem: string): string[] {
        const parts = orderByItem.split(' ');
        if (parts.length !== 2) {
            throw new MetricFilterError(
                `Wrong order by definition: '${orderByItem}'. Specify 'metric type' or '${OrderByUtils.specialOrderBy.join(
                    ' or '
                )}' and order by direction(ASC, DESC).`
            );
        }
        return parts;
    }

    private static parseOrderByItem(orderByItem: string): OrderByVo {
        const parts = OrderByUtils.split(orderByItem);
        let metricType = MetricType[parts[0].toUpperCase()];
        if (metricType === undefined) {
            if (OrderByUtils.isSpecial(parts[0])) {
                metricType = parts[0].toUpperCase();
            } else {
                throw new MetricFilterError(
                    `Unknown metric type or special field for ordering: '${parts[0]}`
                );
            }
        }
        return {
            type: metricType,
            direction: this.parseDirection(parts[1]),
        };
    }

    private static isSpecial(orderByName: string): boolean {
        return this.specialOrderBy.some(
            (specialOrderByItem) => specialOrderByItem === orderByName
        );
    }

    private static parseDirection(direction: string): OrderByDirection {
        const orderByDirection = direction.toUpperCase() as OrderByDirection;
        if (orderByDirection === undefined) {
            throw new MetricFilterError(
                `Unknown order by direction: '${direction}'`
            );
        }
        return orderByDirection;
    }
}
