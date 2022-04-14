import { TransformationError } from './transformation.error';
import { MetricResponseDto } from '../dto/metric-response.dto';
import { MetricType } from '../enums/metric-type.enum';
import { Owner, StorageEntityType } from '../dto/owner.dto';
import { SystemMetricEntity } from '../entities/system-metric.entity';
import { PoolMetricEntity } from '../entities/pool-metric.entity';
import { ChaMetricEntity } from '../entities/cha-metric.entity';
import { PortMetricEntity } from '../entities/port-metric.entity';
import { HostGroupMetricEntity } from '../entities/host-group-metric.entity';
import { LatencyEntity } from '../entities/latency.entity';
import { StorageEntityStatus } from '../enums/storage-entity-status.enum';
import { isEmpty } from '@nestjs/common/utils/shared.utils';
import { StorageEntityTransformer } from './storage-entity.transformer';
import { ParityGroupMetricEntity } from '../entities/parity-group-metric.entity';

export class MetricTransformer {
    public static transform(
        metricEntity:
            | SystemMetricEntity
            | PoolMetricEntity
            | ChaMetricEntity
            | PortMetricEntity
            | HostGroupMetricEntity
            | LatencyEntity
            | ParityGroupMetricEntity
    ): MetricResponseDto {
        const dto = new MetricResponseDto();

        dto.idMetric = metricEntity.id;
        dto.metricType = MetricTransformer.transformMetricType(
            metricEntity.idType
        );
        dto.value = metricEntity.value;

        if ('peak' in metricEntity) {
            dto.peak = metricEntity.peak;
        }
        if (metricEntity instanceof ParityGroupMetricEntity) {
            dto.startTime = metricEntity.startTime.getTime();
            dto.endTime = metricEntity.endTime.getTime();
            dto.peak = metricEntity.peak;
        } else {
            dto.date = metricEntity.date;
        }
        dto.owner = StorageEntityTransformer.transformFromOwner(
            metricEntity.owner
        );

        return dto;
    }

    private static transformMetricType(type: MetricType): string {
        if (type !== undefined && MetricType[type]) {
            return MetricType[type];
        }
        throw new TransformationError(
            `Metric type \'${type}\' from entity is not in enum 'MetricType'`
        );
    }
}
