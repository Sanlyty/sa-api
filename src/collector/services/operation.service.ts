import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CatOperationEntity } from '../entities/cat-operation.entity';

@Injectable()
export class OperationService {

  constructor(
    @InjectRepository(CatOperationEntity)
    private readonly repository: Repository<CatOperationEntity>,
  ) {
  }

  async findById(idParam: number): Promise<CatOperationEntity> {
    return await this.repository
      .findOne({ id: idParam })
      .then(metricType => metricType);
  }

  async findByMetricTypes(types: number[]) {
    return await this.repository
      .find({ id: In(types) });
  }
}
