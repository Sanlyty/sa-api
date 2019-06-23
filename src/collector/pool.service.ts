import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PoolEntity } from './entities/pool.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PoolService {

  constructor(
    @InjectRepository(PoolEntity)
    private readonly repository: Repository<PoolEntity>,
  ) {
  }

  public async findById(idSystemParam: number, idPoolParam: number): Promise<PoolEntity> {
    const dao = await this.repository
      .findOne({ idSystem: idSystemParam, idInternal: idPoolParam })
      .then(metricType => metricType);

    return dao;
  }
}
