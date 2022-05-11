import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemMetricEntity } from '../entities/system-metric.entity';
import { MetricTypeService } from './metric-type.service';
import { MetricType } from '../enums/metric-type.enum';
import { SystemMetricReadEntity } from '../entities/system-metric-read.entity';
import { MetricEntityInterface } from '../entities/metric-entity.interface';
import { StorageEntityStatus } from '../enums/storage-entity-status.enum';

@Injectable()
export class SystemMetricService {
    constructor(
        @InjectRepository(SystemMetricEntity)
        private readonly metricRepository: Repository<SystemMetricEntity>,
        @InjectRepository(SystemMetricReadEntity)
        private readonly metricReadRepository: Repository<SystemMetricReadEntity>,
        private readonly metricTypeService: MetricTypeService
    ) {}

    async getMetricGraph(type: MetricType): Promise<SystemMetricEntity[]> {
        const types = await this.metricTypeService.findByMetricTypes([type]);
        return await this.metricRepository
            .createQueryBuilder('metrics')
            .select('metrics.date', 'date')
            .addSelect('SUM(metrics.value)', 'value')
            .where('metrics.metricTypeEntity IN (:...idType)', {
                idType: types.map((typeObj) => typeObj.id),
            })
            .andWhere('metrics.date < current_date')
            .groupBy('metrics.date')
            .orderBy('metrics.date')
            .getRawMany();
    }

    // TODO this could be as generic parametrized
    public async getAlerts() {
        const types = [
            MetricType.CPU_PERC,
            MetricType.HDD_PERC,
            MetricType.RESPONSE,
            MetricType.WRITE_PENDING_PERC,
        ];
        return await this.metricReadRepository
            .createQueryBuilder('metric')
            .innerJoinAndSelect('metric.metricTypeEntity', 'type')
            .innerJoinAndSelect('type.threshold', 'threshold')
            .innerJoinAndSelect('metric.owner', 'system')
            .innerJoinAndSelect('system.parent', 'datacenter')
            .where('metric.value >= COALESCE(threshold.min_value, -2147483648)')
            .andWhere(
                'metric.value < COALESCE(threshold.max_value, 2147483647)'
            )
            .andWhere('system.idCatComponentStatus = :idSystemStatus', {
                idSystemStatus: StorageEntityStatus.ACTIVE,
            })
            .andWhere('metric.metricTypeEntity IN (:...type)', {
                type: types.map((type) => type),
            })
            .getMany();
    }

    public async getMetrics(): Promise<MetricEntityInterface[]> {
        const types = await this.metricTypeService.findByMetricTypes([
            MetricType.WORKLOAD,
            MetricType.TRANSFER,
        ]);
        const result = [];
        for (const type of types) {
            const entities = await this.metricReadRepository.find({
                metricTypeEntity: type,
            });
            result.push(SystemMetricService.aggregateMetric(entities));
        }
        return result;
    }

    private static aggregateMetric(
        metrics: SystemMetricReadEntity[]
    ): MetricEntityInterface {
        const data = metrics;
        const result = new SystemMetricReadEntity();
        result.metricTypeEntity = data[0].metricTypeEntity;
        result.value = data.reduce(
            (accumulator, currentValue) => accumulator + currentValue.value,
            0
        );
        return result;
    }
}
