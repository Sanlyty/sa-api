import { BadRequestException, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SystemMetricEntity } from '../entities/system-metric.entity';
import { PoolMetricEntity } from '../entities/pool-metric.entity';
import { ChaMetricEntity } from '../entities/cha-metric.entity';
import { HostGroupMetricEntity } from '../entities/host-group-metric.entity';
import { PortMetricEntity } from '../entities/port-metric.entity';
import { StorageEntityType } from '../dto/owner.dto';
import { AbstractMetricEntity } from '../entities/abstract-metric.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MetricType } from '../enums/metric-type.enum';
import { LatencyEntity } from '../entities/latency.entity';
import { ParityGroupMetricEntity } from '../entities/parity-group-metric.entity';

@Injectable()
export class MetricRepositoryFactory {
    constructor(
        @InjectRepository(SystemMetricEntity)
        private systemRepository: Repository<SystemMetricEntity>,
        @InjectRepository(PoolMetricEntity)
        private poolRepository: Repository<PoolMetricEntity>,
        @InjectRepository(ChaMetricEntity)
        private adapterRepository: Repository<ChaMetricEntity>,
        @InjectRepository(HostGroupMetricEntity)
        private hostGroupRepository: Repository<HostGroupMetricEntity>,
        @InjectRepository(PortMetricEntity)
        private portRepository: Repository<PortMetricEntity>,
        @InjectRepository(LatencyEntity)
        private latencyRepository: Repository<LatencyEntity>,
        @InjectRepository(ParityGroupMetricEntity)
        private parityGroupRepository: Repository<ParityGroupMetricEntity>
    ) {}

    public getByStorageEntityType(
        type: StorageEntityType,
        metricType: MetricType
    ): Repository<AbstractMetricEntity | ParityGroupMetricEntity> {
        switch (type) {
            case StorageEntityType.SYSTEM:
                return this.systemRepository;
            case StorageEntityType.POOL:
                if (metricType === MetricType.LATENCY_PER_BLOCK_SIZE) {
                    return this.latencyRepository;
                }
                return this.poolRepository;
            case StorageEntityType.ADAPTER_GROUP:
                return this.adapterRepository;
            case StorageEntityType.HOST_GROUP:
                return this.hostGroupRepository;
            case StorageEntityType.PORT_GROUP:
                return this.portRepository;
            case StorageEntityType.PARITY_GROUP:
                return this.parityGroupRepository;
            default:
                throw new BadRequestException(
                    `Cannot find repository for specified type '${StorageEntityType[type]}'`
                );
        }
    }
}
