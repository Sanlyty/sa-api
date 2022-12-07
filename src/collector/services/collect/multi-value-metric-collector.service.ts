import { Injectable } from '@nestjs/common';

import { StorageEntityEntity } from '../../entities/storage-entity.entity';
import { MetricRequestDto } from '../../dto/metric-request.dto';
import { LatencyEntity } from '../../entities/latency.entity';
import { StorageEntityRepository } from '../../repositories/storage-entity.repository';
import { MetricRepositoryFactory } from '../../factory/metric-repository.factory';
import { LatencyRequestDto } from '../../dto/latency-request.dto';

import { AbstractMetricCollectorService, MetricCollectorCommand } from './abstract-metric-collector.service';

@Injectable()
export class MultiValueMetricCollectorService extends AbstractMetricCollectorService {
  constructor(protected storageEntityRepository: StorageEntityRepository,
              protected metricRepositoryFactory: MetricRepositoryFactory) {
    super(storageEntityRepository, metricRepositoryFactory);
  }

  protected getMatchCriteria(metricRequestDto: MetricRequestDto, storageEntity: StorageEntityEntity, metricValueItem?) {
    return {
      owner: storageEntity,
      metricTypeEntity: metricRequestDto.metricType,
      date: metricRequestDto.date,
      idOperation: metricRequestDto.operation,
      blockSize: metricValueItem.blockSize,
      latency: metricValueItem.latency,
    };
  }

  protected async mapData(command: MetricCollectorCommand) {
    const entity = await this.createMetricEntity(command) as LatencyEntity;
    const metricRequest = command.requestDto;
    const latencyRequest = command.dataMetricDto as LatencyRequestDto;
    const storageEntity = command.storageEntity;

    entity.date = metricRequest.date;
    entity.latency = latencyRequest.latency;
    entity.blockSize = latencyRequest.blockSize;
    entity.value = latencyRequest.count;
    entity.idOperation = metricRequest.operation;
    entity.idType = metricRequest.metricType;
    if (entity.owner == null) {
      entity.owner = storageEntity;
    }
    return entity;
  }

}
