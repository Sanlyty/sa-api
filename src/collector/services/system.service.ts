import { Injectable } from '@nestjs/common';
import { SystemEntity } from '../entities/system.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateComponentInterface } from './createComponentInterface';

@Injectable()
export class SystemService implements CreateComponentInterface<SystemEntity> {

  constructor(
    @InjectRepository(SystemEntity)
    private readonly repository: Repository<SystemEntity>,
  ) {
  }

  async findById(id: number): Promise<SystemEntity> {
    return await this.repository
      .findOne({ idSystem: id });
  }

  async findByName(systemName: string): Promise<SystemEntity> {
    return await this.repository
      .findOne({ name: systemName });
  }

  async create(systemName: string): Promise<SystemEntity> {
    const system = new SystemEntity();
    system.name = systemName;
    system.idDataCenter = 1; // Todo this is temporary

    return await this.repository.save(system);
  }
}
