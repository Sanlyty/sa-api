import { Injectable } from '@nestjs/common';

import { MetricRequestDto } from '../../dto/metric-request.dto';
import { StorageEntityRepository } from '../../repositories/storage-entity.repository';
import { MetricRepositoryFactory } from '../../factory/metric-repository.factory';
import { AbstractMetricEntity } from '../../entities/abstract-metric.entity';
import { StorageEntityEntity } from '../../entities/storage-entity.entity';
import { SystemMetricEntity } from '../../entities/system-metric.entity';
import { ParityGroupMetricRequestDto } from '../../dto/parity-group-metric-request.dto';
import { ParityGroupMetricEntity } from '../../entities/parity-group-metric.entity';

import { AbstractMetricCollectorService, MetricCollectorCommand } from './abstract-metric-collector.service';

@Injectable()
export class MetricCollectorService extends AbstractMetricCollectorService {
  constructor(protected storageEntityRepository: StorageEntityRepository,
              protected metricRepositoryFactory: MetricRepositoryFactory) {
    super(storageEntityRepository, metricRepositoryFactory);
  }

  protected async mapData(command: MetricCollectorCommand) {
    const metricEntity = await this.createMetricEntity(command);
    const metricRequest = command.requestDto;
    metricEntity.value = metricRequest.value;
    metricEntity.idType = metricRequest.metricType;

    if (metricEntity.owner === undefined) {
      metricEntity.owner = command.storageEntity;
    }

    if (metricEntity instanceof SystemMetricEntity) {
      metricEntity.peak = metricRequest.peak;
    }
    if (metricRequest instanceof ParityGroupMetricRequestDto && metricEntity instanceof ParityGroupMetricEntity) {
      metricEntity.startTime = new Date(metricRequest.startTime);
      metricEntity.endTime = new Date(metricRequest.endTime);
      metricEntity.peak = metricRequest.peak
    } else if(metricEntity instanceof AbstractMetricEntity) {
      metricEntity.date = metricRequest.date;
    }
    return metricEntity;
  }

  protected getMatchCriteria(metricRequest: MetricRequestDto, storageEntity: StorageEntityEntity)
    : Partial<AbstractMetricEntity | ParityGroupMetricEntity> {
    if (metricRequest instanceof ParityGroupMetricRequestDto) {
      return {
        startTime: new Date(metricRequest.startTime),
        endTime: new Date(metricRequest.endTime),
        idType: metricRequest.metricType,
        owner: storageEntity,
      };
    }
    return {
      date: metricRequest.date,
      idType: metricRequest.metricType,
      owner: storageEntity,
    };

  }

}
