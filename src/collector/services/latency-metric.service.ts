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

function isEmptyOrContains<T>(data: T[], item: T) {
    return isEmpty(data) || data.indexOf(item) >= 0;
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
            .filter(([, key]) => !isEmpty(filter[key]))
            .forEach(([field, key]) =>
                query.andWhere(`${field} IN (:...${key})`, filter)
            );

        type ResultKey = string;
        const result = new Map<ResultKey, number>();

        for (const {
            operation,
            latency,
            blockSize,
            count,
        } of await query.getRawMany()) {
            const idx = `${operation};${latency};${blockSize}`;

            const prev = result.has(idx) ? result.get(idx) : 0;
            result.set(idx, prev + Number.parseInt(count, 10));
        }

        // handle maintainer
        for (const system of byMaintainer) {
            for (const pool of system.children) {
                if (!isEmptyOrContains(filter.poolIds, pool.id)) continue;

                for (const [opId, op] of [
                    [1, 'READ'],
                    [2, 'WRITE'],
                ] as const) {
                    if (!isEmptyOrContains(filter.operations, opId)) continue;

                    const maintData =
                        await this.mainteinerService.getLatencyAnalysis(
                            system.name,
                            pool.name,
                            op,
                            filter.dates as unknown as string[]
                        );

                    maintData.forEach((row) => {
                        const latency = Math.pow(2, row[0]);
                        const blockSize = Math.pow(2, row[1]);
                        const value = row[2];

                        if (!isEmptyOrContains(filter.latencies, latency))
                            return;
                        if (!isEmptyOrContains(filter.blockSizes, blockSize))
                            return;

                        const idx = `${opId};${latency};${blockSize}`;
                        const prev = result.has(idx) ? result.get(idx) : 0;
                        result.set(idx, prev + value);
                    });
                }
            }
        }

        const transformed = [];

        for (const [key, val] of result) {
            const operation = Number.parseInt(key.split(';')[0], 10);
            const [latency, blockSize] = key
                .split(';')
                .slice(1)
                .map((v) => Number.parseFloat(v));

            transformed.push({
                operation,
                latency,
                blockSize,
                count: val.toString(),
            });
        }

        return transformed;
    }

    public async availableDates(): Promise<string[]> {
        const entities = await this.metricRepository
            .createQueryBuilder('metric')
            .select('CAST(metric.date AS VARCHAR)', 'date')
            .groupBy('metric.date')
            .getRawMany();

        const dates = new Set(entities.map((entity) => entity.date));

        // get systems handled by a maintainer
        const byMaintainer = (
            await this.storageRepository.availableSystems()
        ).filter((s) => this.mainteinerService.handlesSystem(s.name));

        await Promise.all(
            byMaintainer.map(async (m) => {
                const newDates =
                    await this.mainteinerService.getLatencyAnalysisDates(
                        m.name
                    );

                newDates.forEach((d) => dates.add(d));
            })
        );

        return [...dates];
    }
}
