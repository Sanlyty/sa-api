import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LatencyEntity } from '../entities/latency.entity';
import { isEmpty } from '@nestjs/common/utils/shared.utils';
import { LatencyFilter } from '../../statistics/controllers/latency/latency.controller';
import { StorageEntityRepository } from '../repositories/storage-entity.repository';
import { MaintainerService } from './maintainer.service';

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
        private metricRepository: Repository<LatencyEntity>,
        private storageRepository: StorageEntityRepository,
        private mainteinerService: MaintainerService
    ) {}

    public async frequencyByLatencyBlockSize(
        filter: LatencyFilter
    ): Promise<LatencyData[]> {
        // get systems handled by a maintainer
        const byMaintainer = (
            await this.storageRepository.availableSystems()
        ).filter((s) => this.mainteinerService.handlesSystem(s.name));

        // skip pools related to maintainers
        const skippedPools = byMaintainer.flatMap((s) =>
            s.children.map((c) => c.id)
        );

        const query = this.metricRepository
            .createQueryBuilder('metric')
            .select('metric.blockSize', 'blockSize')
            .addSelect('metric.latency', 'latency')
            .addSelect('metric.idOperation', 'operation')
            .addSelect('CAST(SUM(metric.value) as BIGINT)', 'count')
            .innerJoin('metric.owner', 'pool')
            .where('pool.id NOT IN (:...skippedPools)', { skippedPools })
            .groupBy('metric.latency')
            .addGroupBy('metric.blockSize')
            .addGroupBy('metric.idOperation');

        const filterFields: [string, keyof LatencyFilter][] = [
            ['pool.id', 'poolIds'],
            ['metric.date', 'dates'],
            ['metric.idOperation', 'operations'],
            ['metric.blockSize', 'blockSizes'],
            ['metric.latency', 'latencies'],
        ];

        filterFields
            .filter(([_, key]) => !isEmpty(filter[key]))
            .forEach(([field, key]) =>
                query.andWhere(`${field} IN (:...${key})`, filter)
            );

        const result = await query.getRawMany();

        // handle maintainer

        return result;
    }

    public async availableDates(): Promise<string[]> {
        const entities = await this.metricRepository
            .createQueryBuilder('metric')
            .select('CAST(metric.date AS VARCHAR)', 'date')
            .groupBy('metric.date')
            .getRawMany();

        return entities.map((entity) => entity.date);
    }
}
