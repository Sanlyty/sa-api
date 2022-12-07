import { LatencyEntity } from '../entities/latency.entity';
import { LatencyResponseDto } from '../dto/latency-response.dto';
import { MetricType } from '../enums/metric-type.enum';
import { LatencyRequestDto } from '../dto/latency-request.dto';
import { OperationType } from '../enums/operation-type.enum';

import { StorageEntityTransformer } from './storage-entity.transformer';

export class LatencyMetricTransformer {
    public static transform(metrics: LatencyEntity[]): LatencyResponseDto {
        const response = new LatencyResponseDto();
        const metric = metrics[0];
        response.metricType = MetricType[metric.idType];
        response.owner = StorageEntityTransformer.transformFromOwner(
            metric.owner
        );
        response.date = metric.date;
        response.operation = OperationType[metric.idOperation];

        response.data = metrics.map((item) =>
            LatencyMetricTransformer.transformMetric(item)
        );
        return response;
    }

    private static transformMetric(metric: LatencyEntity) {
        // little hack for tests, fields from MetricResponseDto must be copied to created object LatencyMetricDto
        // const dto: LatencyMetricDto = Object.assign(new LatencyMetricDto(), MetricTransformer.transform(metric)) as LatencyMetricDto;
        const dto = new LatencyRequestDto();
        dto.latency = metric.latency;
        dto.blockSize = metric.blockSize;
        dto.count = metric.value;

        return dto;
    }
}
