import { isEmpty } from '@nestjs/common/utils/shared.utils';

import { StorageEntityEntity } from '../../collector/entities/storage-entity.entity';
import { ExternalType } from '../../collector/enums/external-type.enum';

import { OrderByVo } from './vo/order-by.vo';


export type OrderByDirection = 'ASC' | 'DESC';

export class SortStorageEntityByMetricUtils {
    public static sort(
        storageEntities: StorageEntityEntity[],
        orderBy: OrderByVo[]
    ) {
        storageEntities.forEach((entity) => {
            if (isEmpty(entity.children)) {
                return;
            } else {
                if (entity.children.some((child) => !isEmpty(child.metrics))) {
                    entity.children = this.sortByMetrics(
                        entity.children,
                        orderBy
                    );
                } else {
                    entity.children = this.sort(entity.children, orderBy);
                }
            }
        });
        return this.sortParentEntities(storageEntities, orderBy);
    }

    private static sortByMetrics(
        metrics: StorageEntityEntity[],
        orderBy: OrderByVo[]
    ) {
        return metrics.sort((a, b) =>
            this.compare(a, b, orderBy, (storageEntity, type) =>
                this.getMetricValue(storageEntity, type)
            )
        );
    }

    private static compare(
        a: StorageEntityEntity,
        b: StorageEntityEntity,
        orderBy: OrderByVo[],
        getMetric: (
            storageEntity: StorageEntityEntity,
            type: OrderByVo
        ) => number | string
    ) {
        const orderByValue = orderBy[0];
        let aValue;
        let bValue;
        if (orderByValue.direction === 'ASC') {
            aValue = getMetric(a, orderByValue);
            bValue = getMetric(b, orderByValue);
        } else {
            aValue = getMetric(b, orderByValue);
            bValue = getMetric(a, orderByValue);
        }
        const compare = this.compareValues(aValue, bValue);
        if (compare !== 0) {
            return compare;
        }
        if (orderBy.length === 1) {
            return 0;
        }
        return this.compare(a, b, orderBy.slice(1), getMetric);
    }

    private static getMetricValue(
        storageEntity: StorageEntityEntity,
        orderByVo: OrderByVo
    ) {
        const type = orderByVo.type;
        if (type === 'NAME') {
            return storageEntity.name;
        }
        if (type === 'REFERENCE_ID') {
            if (storageEntity.parent !== undefined) {
                return storageEntity.parent.serialNumber;
            }
            return null;
        }
        if (type === 'TIER') {
            if (!isEmpty(storageEntity.externals)) {
                const sortedExternals = storageEntity.externals
                    .filter((ext) => ext.idType === ExternalType.TIER)
                    .sort((a, b) =>
                        orderByVo.direction === 'ASC'
                            ? this.compareValues(a.value, b.value)
                            : this.compareValues(b.value, a.value)
                    );
                return sortedExternals.length > 0
                    ? sortedExternals[0].value
                    : null;
            }
            return null;
        }
        const foundMetric = storageEntity.metrics.find(
            (metric) => metric.metricTypeEntity.id === type
        );
        if (foundMetric === undefined) {
            return null;
        }
        return foundMetric.value;
    }

    private static sortParentEntities(
        storageEntities: StorageEntityEntity[],
        orderBy: OrderByVo[]
    ) {
        return storageEntities.sort((a, b) =>
            this.compare(a, b, orderBy, (storageEntity, type) =>
                this.getMetricValueFromParent(storageEntity, type)
            )
        );
    }

    private static getMetricValueFromParent(
        storageEntity: StorageEntityEntity,
        orderBy: OrderByVo
    ) {
        if (!isEmpty(storageEntity.children)) {
            return this.getMetricValueFromParent(
                storageEntity.children[0],
                orderBy
            );
        }
        if (!isEmpty(storageEntity.metrics)) {
            return this.getMetricValue(storageEntity, orderBy);
        }
        return null;
    }

    private static compareValues(aValue, bValue) {
        if (aValue === null && bValue === null) {
            return 0;
        }
        if (aValue === null && bValue !== null) {
            return -1;
        }
        if (aValue !== null && bValue === null) {
            return 1;
        }
        if (aValue > bValue) {
            return 1;
        }
        if (aValue < bValue) {
            return -1;
        }
        return 0;
    }
}
