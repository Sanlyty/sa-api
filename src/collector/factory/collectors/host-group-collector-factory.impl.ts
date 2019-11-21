import { CollectorFactory } from '../collector-factory.interface';
import { Injectable, Scope } from '@nestjs/common';
import { HostGroupMetricEntity } from '../../entities/host-group-metric.entity';
import { MetricResponseDto } from '../../dto/metric-response.dto';
import { HostGroupMetricResponseTransformer } from '../../transformers/host-group-metric-response.transformer';
import { HostGroupMetricService } from '../../services/host-group-metric.service';
import { MetricRequestDto } from '../../dto/metric-request.dto';
import { ComponentKey } from '../../controllers/metric.controller';

@Injectable({ scope: Scope.DEFAULT })
export class HostGroupCollectorFactoryImpl implements CollectorFactory<HostGroupMetricEntity> {
  constructor(private transformer: HostGroupMetricResponseTransformer,
              private service: HostGroupMetricService) {
  }

  async collectMetric(componentKey: ComponentKey, request: MetricRequestDto): Promise<HostGroupMetricEntity> {
    return await this.service.createOrUpdateMetric(componentKey, request);
  }

  transform(input: HostGroupMetricEntity): MetricResponseDto {
    return this.transformer.transform(input);
  }

}
