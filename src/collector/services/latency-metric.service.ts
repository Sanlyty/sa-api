import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LatencyEntity } from '../entities/latency.entity';
import { isEmpty } from '@nestjs/common/utils/shared.utils';
import { LatencyFilter } from '../../statistics/controllers/latency/latency.controller';

export interface LatencyData {
    blockSize: number;
    latency: number;
    count: number;
    operation: number;
}

@Injectable()
export class LatencyMetricService {
    constructor(
        @InjectRepository(LatencyEntity)
        private metricRepository: Repository<LatencyEntity>
    ) {}

    public async frequencyByLatencyBlockSize(
        filter: LatencyFilter
    ): Promise<LatencyData[]> {
        const query = this.metricRepository
            .createQueryBuilder('metric')
            .select('metric.blockSize', 'blockSize')
            .addSelect('metric.latency', 'latency')
            .addSelect('metric.idOperation', 'operation')
            .addSelect('CAST(SUM(metric.value) as BIGINT)', 'count')
            .innerJoin('metric.owner', 'pool')
            .groupBy('metric.latency')
            .addGroupBy('metric.blockSize')
            .addGroupBy('metric.idOperation');
        if (!isEmpty(filter.poolIds)) {
            query.where('pool.id IN (:...ids)', { ids: filter.poolIds });
        }
        if (!isEmpty(filter.dates)) {
            query.andWhere('metric.date IN (:...dates)', {
                dates: filter.dates,
            });
        }
        if (!isEmpty(filter.operations)) {
            query.andWhere('metric.idOperation IN (:...operations)', {
                operations: filter.operations.map((operation) => operation),
            });
        }
        if (!isEmpty(filter.blockSizes)) {
            query.andWhere('metric.blockSize IN (:...blockSizes)', {
                blockSizes: filter.blockSizes,
            });
        }
        if (!isEmpty(filter.latencies)) {
            query.andWhere('metric.latency IN (:...latencies)', {
                latencies: filter.latencies,
            });
        }
        return query.getRawMany();
    }

    // TODO maybe use await async in all "manager" methods when fetching
    public async availableDates(): Promise<string[]> {
        const entities = await this.metricRepository
            .createQueryBuilder('metric')
            .select('CAST(metric.date AS VARCHAR)', 'date')
            .groupBy('metric.date')
            .getRawMany();
        return entities.map((entity) => entity.date);
    }
}
