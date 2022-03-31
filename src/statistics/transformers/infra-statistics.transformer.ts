import { ChaMetricEntity } from '../../collector/entities/cha-metric.entity';
import { InfrastructureDto } from '../models/metrics/InfrastructureDto';
import { Alert } from '../models/metrics/Alert';
import { Occurrence } from '../models/metrics/Occurrence';
import { EntityType } from '../models/metrics/EntityType';
import { PoolMetricEntity } from '../../collector/entities/pool-metric.entity';
import { MetricEntityInterface } from '../../collector/entities/metric-entity.interface';
import { MetricType } from '../../collector/enums/metric-type.enum';
import { AlertType } from '../models/metrics/AlertType';
import { SystemMetricEntity } from '../../collector/entities/system-metric.entity';
import { Metric } from '../models/metrics/Metric';
import { TypeMappingUtils } from '../utils/type-mapping.utils';
import { RegionMetricInterface } from '../services/aggregated-metric.service';
import { PortMetricEntity } from '../../collector/entities/port-metric.entity';

export class InfraStatisticsTransformer {
    private static alertsInit = [
        AlertType.WRITE_PENDING,
        AlertType.RESPONSE,
        AlertType.HDD,
        AlertType.CPU,
        AlertType.SLA_EVENTS,
        AlertType.DISBALANCE_EVENTS,
        AlertType.CAPACITY_USAGE,
    ];

    public static async transform(
        alertsInput: Promise<MetricEntityInterface[]>,
        metricsInput: RegionMetricInterface[]
    ) {
        const dto = new InfrastructureDto();
        this.initDto(dto);
        const metrics = await alertsInput;
        const perfMetrics = metricsInput;

        metrics.forEach((metric) => {
            const alert = InfraStatisticsTransformer.findAlert(
                metric.metricTypeEntity.id,
                dto
            );
            let occurrence = null;
            switch (metric.metricTypeEntity.id) {
                case MetricType.SLA_EVENTS:
                case MetricType.PHYSICAL_USED_PERC:
                    occurrence = InfraStatisticsTransformer.transformPoolOccurrence(
                        metric as PoolMetricEntity,
                        'pool'
                    );
                    break;
                case MetricType.IMBALANCE_EVENTS:
                    occurrence = InfraStatisticsTransformer.transformAdapterOccurrence(
                        metric as ChaMetricEntity,
                        'adapter'
                    );
                    break;
                case MetricType.PORT_IMBALANCE_EVENTS:
                    occurrence = InfraStatisticsTransformer.transformPortMetric(
                        metric as PortMetricEntity,
                        'port'
                    );
                    break;
                case MetricType.HDD_PERC:
                case MetricType.CPU_PERC:
                case MetricType.WRITE_PENDING_PERC:
                case MetricType.RESPONSE:
                    occurrence = InfraStatisticsTransformer.transformSystemOccurrence(
                        metric as SystemMetricEntity,
                        'system'
                    );
                    break;
            }
            alert.minValue = metric.metricTypeEntity.threshold.minValue;
            alert.maxValue = metric.metricTypeEntity.threshold.maxValue;
            alert.unit = metric.metricTypeEntity.unit;
            alert.occurrences.push(occurrence);
        });
        dto.metrics = perfMetrics.map((regionData) => {
            return {
                region: regionData.region,
                metrics: regionData.metrics.map((metric) =>
                    InfraStatisticsTransformer.transformSimpleMetric(
                        metric as SystemMetricEntity
                    )
                ),
            };
        });
        return dto;
    }

    private static transformPoolOccurrence(
        metric: PoolMetricEntity,
        entityType: EntityType
    ) {
        const occurrence = new Occurrence();
        occurrence.datacenterId = metric.owner.parent.parent.id;
        occurrence.entityId = metric.owner.id;
        occurrence.entityType = entityType;
        occurrence.name = metric.owner.name;
        occurrence.systemId = metric.owner.parent.id;
        occurrence.unit = metric.metricTypeEntity.unit;
        occurrence.value = metric.value;
        return occurrence;
    }

    private static transformAdapterOccurrence(
        metric: ChaMetricEntity,
        entityType: EntityType
    ) {
        const occurrence = new Occurrence();
        occurrence.datacenterId = metric.owner.parent.parent.id;
        occurrence.entityId = metric.owner.id;
        occurrence.entityType = entityType;
        occurrence.name = metric.owner.name;
        occurrence.systemId = metric.owner.parent.id;
        occurrence.unit = metric.metricTypeEntity.unit;
        occurrence.value = metric.value;
        return occurrence;
    }

    private static transformPortMetric(
        metric: PortMetricEntity,
        entityType: EntityType
    ) {
        const occurrence = new Occurrence();
        occurrence.datacenterId = metric.owner.parent.parent.parent.id;
        occurrence.entityId = metric.owner.id;
        occurrence.entityType = entityType;
        occurrence.middleEntityId = metric.owner.parent.id;
        occurrence.middleEntityType = 'adapter';
        occurrence.middleEntityName = metric.owner.parent.name;
        occurrence.name = metric.owner.name;
        occurrence.systemId = metric.owner.parent.parent.id;
        occurrence.unit = metric.metricTypeEntity.unit;
        occurrence.value = metric.value;
        return occurrence;
    }

    private static findAlert(type: MetricType, dto: InfrastructureDto) {
        let result = dto.alerts.find(
            (alert) =>
                alert.type === InfraStatisticsTransformer.resolveAlertType(type)
        );
        if (result === undefined) {
            result = new Alert();
            result.type = InfraStatisticsTransformer.resolveAlertType(type);
            dto.alerts.push(result);
            result.occurrences = [];
        }
        return result;
    }

    private static resolveAlertType(type: MetricType): AlertType {
        switch (type) {
            case MetricType.SLA_EVENTS:
                return AlertType.SLA_EVENTS;
            case MetricType.IMBALANCE_EVENTS:
                return AlertType.DISBALANCE_EVENTS;
            case MetricType.PORT_IMBALANCE_EVENTS:
                return AlertType.PORT_DISBALANCE_EVENTS;
            case MetricType.CPU_PERC:
                return AlertType.CPU;
            case MetricType.HDD_PERC:
                return AlertType.HDD;
            case MetricType.RESPONSE:
                return AlertType.RESPONSE;
            case MetricType.WRITE_PENDING_PERC:
                return AlertType.WRITE_PENDING;
            case MetricType.PHYSICAL_USED_PERC:
                return AlertType.CAPACITY_USAGE;
        }
    }

    private static transformSystemOccurrence(
        metric: SystemMetricEntity,
        type: EntityType
    ) {
        const occurrence = new Occurrence();
        occurrence.datacenterId = metric.owner.parent.id;
        occurrence.entityId = metric.owner.id;
        occurrence.entityType = type;
        occurrence.name = metric.owner.name;
        occurrence.systemId = metric.owner.id;
        occurrence.unit = metric.metricTypeEntity.unit;
        occurrence.value = metric.peak;
        occurrence.average = metric.value;
        return occurrence;
    }

    private static initDto(dto: InfrastructureDto) {
        dto.alerts = this.alertsInit.map((type) => {
            const alertObject = new Alert();
            alertObject.type = type;
            alertObject.occurrences = [];
            return alertObject;
        });
    }

    private static transformSimpleMetric(metric: SystemMetricEntity): Metric {
        const result = new Metric();
        result.unit = metric.metricTypeEntity.unit;
        result.value = metric.value;
        result.type = TypeMappingUtils.resolveMetricType(
            metric.metricTypeEntity.id
        );
        return result;
    }
}
