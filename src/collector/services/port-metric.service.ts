import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTreeRepository, MoreThan, Repository } from 'typeorm';

import { PortMetricReadEntity } from '../entities/port-metric-read.entity';
import { MetricType } from '../enums/metric-type.enum';
import { StorageEntityEntity } from '../entities/storage-entity.entity';

import { MetricTypeService } from './metric-type.service';

@Injectable()
export class PortMetricService {

  constructor(
    @InjectRepository(PortMetricReadEntity)
    private readonly metricReadRepository: Repository<PortMetricReadEntity>,
    private readonly metricTypeService: MetricTypeService,
  ) {
  }

  public async getAlerts(): Promise<PortMetricReadEntity[]> {
    const type = await this.metricTypeService.findById(MetricType.PORT_IMBALANCE_EVENTS);
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
