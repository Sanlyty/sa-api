import { Injectable } from '@nestjs/common';

import { StorageEntityEntity } from '../../entities/storage-entity.entity';
import { MetricRequestDto } from '../../dto/metric-request.dto';
import { StorageEntityRepository } from '../../repositories/storage-entity.repository';
import { MetricRepositoryFactory } from '../../factory/metric-repository.factory';
import { ParityGroupMetricRequestDto } from '../../dto/parity-group-metric-request.dto';
import { ParityGroupMetricEntity } from '../../entities/parity-group-metric.entity';

import { AbstractMetricCollectorService, MetricCollectorCommand } from './abstract-metric-collector.service';

@Injectable()
export class PgMultiValueMetricCollectorService extends AbstractMetricCollectorService {
  constructor(protected storageEntityRepository: StorageEntityRepository,
              protected metricRepositoryFactory: MetricRepositoryFactory) {
    super(storageEntityRepository, metricRepositoryFactory);
  }

  protected getMatchCriteria(metricRequestDto: MetricRequestDto, storageEntity: StorageEntityEntity, metricValueItem?: ParityGroupMetricRequestDto) {
    return {
      owner: storageEntity,
      idType: metricRequestDto.metricType,
      startTime: new Date(metricValueItem.startTime),
      endTime: new Date(metricValueItem.endTime),
    };
  }

  protected async mapData(command: MetricCollectorCommand) {
    const entity = await this.createMetricEntity(command) as ParityGroupMetricEntity;
    const metricRequest = command.requestDto;
    const latencyRequest = command.dataMetricDto as ParityGroupMetricRequestDto;
    const storageEntity = command.storageEntity;

    entity.startTime = new Date(latencyRequest.startTime);
    entity.endTime = new Date(latencyRequest.endTime);
    entity.value = latencyRequest.value;
    entity.peak = latencyRequest.peak;
    entity.idType = metricRequest.metricType;
    if (entity.owner == null) {
      entity.owner = storageEntity;
    }
    return entity;
  }

}
