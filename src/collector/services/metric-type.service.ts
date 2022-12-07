import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CatMetricTypeEntity } from '../entities/cat-metric-type.entity';

@Injectable()
export class MetricTypeService {

  constructor(
    @InjectRepository(CatMetricTypeEntity)
    private readonly repository: Repository<CatMetricTypeEntity>,
  ) {
  }

  async findById(idParam: number): Promise<CatMetricTypeEntity> {
    return await this.repository
      .findOne({ id: idParam })
      .then(metricType => metricType);
  }

  async findByMetricTypes(types: number[]) {
    return await this.repository
      .find({ id: In(types) });
  }
}
