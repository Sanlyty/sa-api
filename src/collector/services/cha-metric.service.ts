import { Injectable } from '@nestjs/common';
import { getTreeRepository, MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { ChaMetricEntity } from '../entities/cha-metric.entity';
import { MetricType } from '../enums/metric-type.enum';
import { ChaMetricReadEntity } from '../entities/cha-metric-read.entity';
import { StorageEntityEntity } from '../entities/storage-entity.entity';

import { MetricTypeService } from './metric-type.service';

@Injectable()
export class ChaMetricService {

  constructor(
    @InjectRepository(ChaMetricReadEntity)
    private readonly metricReadRepository: Repository<ChaMetricReadEntity>,
    protected readonly metricTypeService: MetricTypeService,
  ) {
  }

  public async getAlerts(): Promise<ChaMetricEntity[]> {
    const type = await this.metricTypeService.findById(MetricType.IMBALANCE_EVENTS);
    return Promise.all(
      (await this.metricReadRepository.find({ where: { value: MoreThan(0), metricTypeEntity: type } })).map(
        async metric => {
          metric.owner = await getTreeRepository(StorageEntityEntity).findAncestorsTree(metric.owner);
          return metric;
        },
      ),
    );
  }
}
