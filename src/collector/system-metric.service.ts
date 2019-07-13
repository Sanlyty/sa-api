import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemMetricEntity } from './entities/system-metric.entity';
import { SystemMetricRequestDto } from './dto/system-metric-request.dto';
import { SystemEntity } from './entities/system.entity';
import { SystemService } from './system.service';
import { CatMetricTypeEntity } from './entities/cat-metric-type.entity';
import { CommonMetricService } from './common-metric.service';
import { MetricTypeService } from './metric-type.service';
import { MetricGroup } from './data-center.service';

@Injectable()
export class SystemMetricService extends CommonMetricService {

  constructor(
    @InjectRepository(SystemMetricEntity)
    private readonly systemMetricRepository: Repository<SystemMetricEntity>,
    private readonly systemService: SystemService,
    private readonly metricTypeService: MetricTypeService,
  ) {
    super(metricTypeService);
  }

  async upsert(idSystem: number, systemMetric: SystemMetricRequestDto): Promise<SystemMetricEntity> {

    await this.validateSystem(idSystem);
    const metricType = await this.loadMetricType(systemMetric.metricType);
    CommonMetricService.validateMetricType(metricType, systemMetric.metricType, MetricGroup.PERFORMANCE);

    const metricDao: SystemMetricEntity = await this.createMetric(idSystem, metricType, systemMetric.date);

    metricDao.value = systemMetric.value;
    metricDao.idSystem = idSystem;
    metricDao.peak = systemMetric.peak;
    metricDao.date = systemMetric.date;
    metricDao.metricTypeEntity = metricType;

    return await this.systemMetricRepository.save(metricDao);
  }

  private async createMetric(idSystemSearch: number, metricTypeSearch: CatMetricTypeEntity, dateSearch): Promise<SystemMetricEntity> {
    const metricDao = await this.systemMetricRepository
      .findOne({ idSystem: idSystemSearch, metricTypeEntity: metricTypeSearch, date: dateSearch })
      .then(dao => dao);

    if (metricDao === undefined) {
      return new SystemMetricEntity();
    }

    return metricDao;
  }

  private async validateSystem(idSystemSearch: number) {
    const systemDao: SystemEntity = await this.systemService
      .findById(idSystemSearch)
      .then(dao => dao);

    if (systemDao === undefined) {
      throw new NotFoundException('System with id \'' + idSystemSearch + '\' not found');
    }
  }

}
