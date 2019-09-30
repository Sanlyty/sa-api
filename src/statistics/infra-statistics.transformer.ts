import { ChaMetricEntity } from '../collector/entities/cha-metric.entity';
import { InfrastructureDto } from './models/metrics/InfrastructureDto';
import { Alert } from './models/metrics/Alert';
import { Occurrence } from './models/metrics/Occurrence';
import { EntityType } from './models/metrics/EntityType';
import { PoolMetricEntity } from '../collector/entities/pool-metric.entity';
import { MetricEntityInterface } from '../collector/entities/metric-entity.interface';
import { MetricType } from '../collector/enums/metric-type.enum';
import { AlertType } from './models/metrics/AlertType';
import { SystemMetricEntity } from '../collector/entities/system-metric.entity';
import { SystemMetricType } from './models/metrics/SystemMetricType';
import { Metric } from './models/metrics/Metric';

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

  public static async transform(alertsInput: Promise<MetricEntityInterface[]>, metricsInput: Promise<MetricEntityInterface[]>) {
    const dto = new InfrastructureDto();
    this.initDto(dto);
    const metrics = await alertsInput;
    const perfMetrics = await metricsInput;
    metrics.forEach(
      metric => {
        const alert = InfraStatisticsTransformer.findAlert(metric.metricTypeEntity.idCatMetricType, dto);
        let occurrence = null;
        switch (metric.metricTypeEntity.idCatMetricType) {
          case MetricType.SLA_EVENTS:
            occurrence = InfraStatisticsTransformer.transformPoolOccurrence(metric as PoolMetricEntity, EntityType.ADAPTER);
            break;
          case MetricType.DISBALANCE_EVENTS:
            occurrence = InfraStatisticsTransformer.transformAdapterOccurrence(metric as ChaMetricEntity, EntityType.POOL);
            break;
          case MetricType.HDD_PERC:
          case MetricType.CPU_PERC:
          case MetricType.WRITE_PENDING_PERC:
          case MetricType.RESPONSE:
            occurrence = InfraStatisticsTransformer.transformSystemOccurrence(metric as SystemMetricEntity, EntityType.SYSTEM);
            break;
        }
        alert.occurrences.push(occurrence);
      },
    );
    dto.metrics = perfMetrics.map(metric => {
      return InfraStatisticsTransformer.transformSimpleMetric(metric as SystemMetricEntity);
    });
    return dto;
  }

  private static transformPoolOccurrence(metric: PoolMetricEntity, entityType: EntityType) {
    const occurence = new Occurrence();
    occurence.datacenterId = metric.pool.system.idDataCenter;
    occurence.entityId = metric.pool.idPool;
    occurence.entityType = entityType;
    occurence.name = metric.pool.name;
    occurence.systemId = metric.pool.system.idSystem;
    occurence.unit = metric.metricTypeEntity.unit;
    occurence.value = metric.value;
    return occurence;
  }

  private static transformAdapterOccurrence(metric: ChaMetricEntity, entityType: EntityType) {
    const occurrence = new Occurrence();
    occurrence.datacenterId = metric.adapter.system.idDataCenter;
    occurrence.entityId = metric.adapter.idCha;
    occurrence.entityType = entityType;
    occurrence.name = metric.adapter.name;
    occurrence.systemId = metric.adapter.system.idSystem;
    occurrence.unit = metric.metricTypeEntity.unit;
    occurrence.value = metric.value;
    return occurrence;
  }

  private static findAlert(type: MetricType, dto: InfrastructureDto) {
    let result = dto.alerts.find(
      alert => alert.type === InfraStatisticsTransformer.resolveAlertType(type),
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
      case MetricType.DISBALANCE_EVENTS:
        return AlertType.DISBALANCE_EVENTS;
      case MetricType.CPU_PERC:
        return AlertType.CPU;
      case MetricType.HDD_PERC:
        return AlertType.HDD;
      case MetricType.RESPONSE:
        return AlertType.RESPONSE;
      case MetricType.WRITE_PENDING_PERC:
        return AlertType.WRITE_PENDING;
    }
  }

  private static resolveMetricType(type: MetricType): SystemMetricType {
    switch (type) {
      case MetricType.TRANSFER:
        return SystemMetricType.TRANSFER;
      case MetricType.WORKLOAD:
        return SystemMetricType.WORKLOAD;
    }
  }

  private static transformSystemOccurrence(metric: SystemMetricEntity, type: EntityType) {
    const occurrence = new Occurrence();
    occurrence.datacenterId = metric.system.idDataCenter;
    occurrence.entityId = metric.system.idSystem;
    occurrence.entityType = type;
    occurrence.name = metric.system.name;
    occurrence.systemId = metric.system.idSystem;
    occurrence.unit = metric.metricTypeEntity.unit;
    occurrence.value = metric.peak;
    occurrence.average = metric.value;
    return occurrence;
  }

  private static initDto(dto: InfrastructureDto) {
    dto.alerts = this.alertsInit.map(
      type => {
        const alertObject = new Alert();
        alertObject.type = type;
        alertObject.occurrences = [];
        return alertObject;
      },
    );
  }

  private static transformSimpleMetric(metric: SystemMetricEntity) {
    const result = new Metric();
    result.unit = metric.metricTypeEntity.unit;
    result.value = metric.value;
    result.type = InfraStatisticsTransformer.resolveMetricType(metric.metricTypeEntity.idCatMetricType);
    return result;
  }
}