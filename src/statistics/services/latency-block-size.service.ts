import { Injectable } from '@nestjs/common';
import { LatencyMetricService } from '../../collector/services/latency-metric.service';
import { OperationType } from '../../collector/enums/operation-type.enum';
import { ArrayUtils } from '../utils/array.utils';
import { SystemPool } from '../models/SystemPool';
import { LatencyFilter } from '../controllers/latency/latency.controller';
import { StorageEntityService } from '../../collector/services/storage-entity.service';
import { StorageEntityTransformer } from '../../collector/transformers/storage-entity.transformer';

export interface OperationData {
    values: ThreeDimensionValue[];
    operation: OperationType;
}

export interface ThreeDimensionValue {
    x: number;
    y: number;
    z: number;
}

export interface LatencyMetadata {
    dates: string[]; // Instead of date string is used because locale didn't set correctly
    systems: Array<Partial<SystemPool>>;
}

@Injectable()
export class LatencyBlockSizeService {
    constructor(
        private readonly service: LatencyMetricService,
        private readonly storageEntityService: StorageEntityService
    ) {}

    private static mapEntity(data: any[], key: OperationType): OperationData {
        return {
            operation: key,
            values: data.map(
                (i) =>
                    ({
                        x: i.blockSize,
                        y: i.latency,
                        z: parseInt(i.count, 10),
                    } as ThreeDimensionValue)
            ),
        };
    }

    public async frequencyByLatencyBlockSize(
        filter: LatencyFilter
    ): Promise<OperationData[]> {
        const entities = await this.service.frequencyByLatencyBlockSize(filter);
        const groupedBy = ArrayUtils.groupBy(entities, 'operation');

        return filter.operations.map((operation) =>
            LatencyBlockSizeService.mapEntity(
                groupedBy[operation] ?? [],
                operation
            )
        );
    }

    public async getMetaData(): Promise<LatencyMetadata> {
        const datesValues = await this.service.availableDates();
        const poolsValues = await this.storageEntityService.availableSystems();

        return {
            dates: datesValues,
            systems: poolsValues.map((system) =>
                StorageEntityTransformer.transformFromOwner(system, true)
            ),
        };
    }
}
