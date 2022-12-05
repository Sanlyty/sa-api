import { Repository } from 'typeorm';
import { isEmpty } from '@nestjs/common/utils/shared.utils';
import { MetricRequestDto } from '../../dto/metric-request.dto';
import { AbstractMetricEntity } from '../../entities/abstract-metric.entity';
import { StorageEntityRepository } from '../../repositories/storage-entity.repository';
import { MetricRepositoryFactory } from '../../factory/metric-repository.factory';
import { StorageEntityEntity } from '../../entities/storage-entity.entity';
import { LatencyRequestDto } from '../../dto/latency-request.dto';
import { StorageEntityKey } from '../../utils/storage-entity-key.utils';
import { ParityGroupMetricRequestDto } from '../../dto/parity-group-metric-request.dto';
import { ParityGroupMetricEntity } from '../../entities/parity-group-metric.entity';

export interface MetricCollectorCommand {
    repository: Repository<AbstractMetricEntity | ParityGroupMetricEntity>;
    requestDto: MetricRequestDto;
    storageEntity: StorageEntityEntity;
    dataMetricDto: LatencyRequestDto | ParityGroupMetricRequestDto;
}

export abstract class AbstractMetricCollectorService {
    public constructor(
        protected storageEntityRepository: StorageEntityRepository,
        protected metricRepositoryFactory: MetricRepositoryFactory
    ) {}

    protected abstract getMatchCriteria(
        metricRequestDto: MetricRequestDto,
        storageEntity: StorageEntityEntity,
        multiValueData?: LatencyRequestDto | ParityGroupMetricRequestDto
    );

    protected abstract mapData(command: MetricCollectorCommand);

    public async collectMetric(
        componentKey: StorageEntityKey,
        metricRequest: MetricRequestDto
    ) {
        const storageEntity =
            await this.storageEntityRepository.fetchOrCreateByStorageEntityKey(
                componentKey
            );
        const repository = this.metricRepositoryFactory.getByStorageEntityType(
            componentKey.child.type,
            metricRequest.metricType
        );

        const data = isEmpty(metricRequest.data)
            ? [metricRequest]
            : metricRequest.data;

        const entitiesToSave = await Promise.all(
            data.map((item) => {
                const command: MetricCollectorCommand = {
                    repository,
                    requestDto: metricRequest,
                    storageEntity,
                    dataMetricDto: item as LatencyRequestDto,
                };
                return this.mapData(command);
            })
        );
        return await repository.save(entitiesToSave);
    }

    protected async createMetricEntity(
        command: MetricCollectorCommand
    ): Promise<AbstractMetricEntity | ParityGroupMetricEntity> {
        const where = this.getMatchCriteria(
            command.requestDto,
            command.storageEntity,
            command.dataMetricDto
        );

        const metricEntity = await command.repository.findOne({ where });

        if (!metricEntity) return command.repository.create();

        return metricEntity;
    }
}
