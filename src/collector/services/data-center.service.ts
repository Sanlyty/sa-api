import { BadRequestException, Injectable } from '@nestjs/common';
import { MetricType } from '../enums/metric-type.enum';
import { PeriodType } from '../enums/period-type.enum';
import { Region } from '../../statistics/models/dtos/region.enum';
import { StorageEntityStatus } from '../enums/storage-entity-status.enum';
import { StorageEntityRepository } from '../repositories/storage-entity.repository';
import { StorageEntityEntity } from '../entities/storage-entity.entity';
import { PoolMetricReadEntity } from '../entities/pool-metric-read.entity';
import { StorageEntityType } from '../dto/owner.dto';
import { SystemMetricReadEntity } from '../entities/system-metric-read.entity';
import { ChaMetricReadEntity } from '../entities/cha-metric-read.entity';
import { PortMetricReadEntity } from '../entities/port-metric-read.entity';
import { HostGroupMetricReadEntity } from '../entities/host-group-metric-read.entity';
import { isEmpty } from '@nestjs/common/utils/shared.utils';
import { ExternalType } from '../enums/external-type.enum';
import { SortStorageEntityByMetricUtils } from '../../statistics/utils/sort-storage-entity-by-metric.utils';
import { OrderByVo } from '../../statistics/utils/vo/order-by.vo';
import { StorageEntityFilterVo } from '../../statistics/services/vos/storage-entity-filter.vo';
import { OutputType } from '../../statistics/controllers/params/statistics.query-params';
import { StorageEntityDetailsEntity } from '../entities/storage-entity-details.entity';
import { ParityGroupMetricEntity } from '../entities/parity-group-metric.entity';
import { StatisticParams } from '../../statistics/controllers/params/statistic.params';
import { MaintainerService } from './maintainer.service';
import metricTypeMap from './metric-type-map';
import { MetricEntityInterface } from '../entities/metric-entity.interface';

export const enum MetricGroup {
    PERFORMANCE = 1,
    CAPACITY = 2,
    ADAPTERS = 3,
    SLA = 4,
    HOST_GROUPS = 5,
    PARITY_GROUPS = 6,
}

const regionDataCenters = [
    {
        type: Region.EUROPE,
        datacenterName: ['CZ_Chodov', 'CZ_Sitel'],
    },
    {
        type: Region.ASIA,
        datacenterName: ['MY_AIMS', 'MY_Cyberjaya'],
    },
    {
        type: Region.AMERICA,
        datacenterName: ['US_Ashburn', 'US_Mechanicsburg'],
    },
];

@Injectable()
export class DataCenterService {
    constructor(
        private entityRepo: StorageEntityRepository,
        private maintainerService: MaintainerService
    ) {}

    async findById(id: number): Promise<StorageEntityEntity[]> {
        return await this.entityRepo.find({
            where: { id },
        });
    }

    async findByName(name: string): Promise<StorageEntityEntity> {
        return await this.entityRepo.findOne({
            where: { name },
        });
    }

    async getDataCenterIdByRegion(region: Region): Promise<number[]> {
        const foundItem = regionDataCenters.find((i) => i.type === region);

        return await Promise.all(
            (foundItem?.datacenterName ?? []).map(
                async (dataCenterName) =>
                    (await this.findByName(dataCenterName))?.id
            )
        );
    }

    getEmptyDatacenter(
        idDataCenterParam: number
    ): Promise<StorageEntityEntity[]> {
        return this.findById(idDataCenterParam);
    }

    async getAllDataCenters(): Promise<StorageEntityEntity[]> {
        return await this.entityRepo.findDataCenters();
    }

    async getMetricsByGroup(
        metricGroup: MetricGroup,
        idDataCenter: number,
        period: PeriodType,
        statisticParams: StatisticParams
    ): Promise<StorageEntityEntity[]> {
        const types = DataCenterService.resolveMetricTypes(metricGroup, period);

        let dataCenterIds =
            idDataCenter || idDataCenter === 0 ? [idDataCenter] : [];

        switch (metricGroup) {
            case MetricGroup.PERFORMANCE:
                return this.getPerformanceMetrics(types, dataCenterIds);
            case MetricGroup.CAPACITY:
            case MetricGroup.SLA:
                return this.getPoolMetrics(types, dataCenterIds);
            case MetricGroup.ADAPTERS:
                return this.getChannelAdapterMetrics(types, dataCenterIds);
            case MetricGroup.HOST_GROUPS: // TODO:
                return this.getHostGroupMetrics(types, dataCenterIds);
            case MetricGroup.PARITY_GROUPS: // TODO:
                return this.getParityGroupsEvents(
                    types,
                    dataCenterIds,
                    statisticParams.fromDate.toString(),
                    statisticParams.toDate.toString()
                );

            default:
                return await this.getEmptyDatacenter(idDataCenter);
        }
    }

    async getPerformanceMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[]
    ): Promise<StorageEntityEntity[]> {
        const query = this.entityRepo
            .createQueryBuilder('datacenter')
            .leftJoinAndSelect(
                'datacenter.children',
                'system',
                'system.idType=:systemType',
                { systemType: StorageEntityType.SYSTEM }
            )
            .innerJoinAndMapMany(
                'system.metrics',
                SystemMetricReadEntity,
                'metrics',
                'metrics.owner = system.id AND metrics.idType IN (:...metrics)',
                { metrics: metricTypes }
            )
            .leftJoinAndMapOne(
                'system.detail',
                StorageEntityDetailsEntity,
                'detail',
                'detail.id = system.id'
            )
            .leftJoinAndSelect('metrics.metricTypeEntity', 'typeEntity')
            .andWhere('system.idCatComponentStatus = :idSystemStatus', {
                idSystemStatus: StorageEntityStatus.ACTIVE,
            });
        if (idDataCenterParam.length > 0) {
            query.andWhere('datacenter.id IN (:...idDatacenter)', {
                idDatacenter: idDataCenterParam,
            });
        }

        const datacenters = await query.getMany();

        for (const datacenter of datacenters) {
            for (const system of datacenter.children) {
                // Is configured via a maintainer?
                if (this.maintainerService.handlesSystem(system.name)) {
                    await this.maintainerService.getMetricsForEntities(
                        system.name,
                        [system],
                        () => 'average',
                        { additionalKeys: { peak: () => 'peak' } }
                    );
                }
            }
        }

        return datacenters;
    }

    async getPoolMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[]
    ): Promise<StorageEntityEntity[]> {
        const query = this.entityRepo
            .createQueryBuilder('datacenter')
            .leftJoinAndSelect(
                'datacenter.children',
                'system',
                'system.parent = datacenter.id AND system.idType=:systemType',
                { systemType: StorageEntityType.SYSTEM }
            )
            .leftJoinAndMapOne(
                'system.detail',
                StorageEntityDetailsEntity,
                'detail',
                'detail.id = system.id'
            )
            .leftJoinAndSelect(
                'system.children',
                'pool',
                'pool.idType=:poolType',
                { poolType: StorageEntityType.POOL }
            )
            .leftJoinAndMapMany(
                'pool.metrics',
                PoolMetricReadEntity,
                'metrics',
                'metrics.owner = pool.id AND metrics.idType IN (:...metrics)',
                { metrics: metricTypes }
            )
            .leftJoinAndSelect('metrics.metricTypeEntity', 'typeEntity')
            .where('pool.idCatComponentStatus = :idStatus', {
                idStatus: StorageEntityStatus.ACTIVE,
            })
            .andWhere('system.idCatComponentStatus = :idSystemStatus', {
                idSystemStatus: StorageEntityStatus.ACTIVE,
            })
            .andWhere('datacenter.idType = :dataCenterType', {
                dataCenterType: StorageEntityType.DATACENTER,
            });

        if (idDataCenterParam.length > 0) {
            query.andWhere('datacenter.id IN (:...idDatacenter)', {
                idDatacenter: idDataCenterParam,
            });
        }

        const datacenters = await query.getMany();

        for (const datacenter of datacenters) {
            for (const system of datacenter.children) {
                // Is configured via a maintainer?
                if (this.maintainerService.handlesSystem(system.name)) {
                    await this.maintainerService.getMetricsForEntities(
                        system.name,
                        system.children, // Pools
                        (e) => e.serialNumber,
                        {
                            skipMetric: (m) =>
                                m.metricTypeEntity.name.startsWith(
                                    'OUT_OF_SLA'
                                ),
                        }
                    );
                }
            }
        }

        return datacenters;
    }

    async getChannelAdapterMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[]
    ): Promise<StorageEntityEntity[]> {
        const query = this.entityRepo
            .createQueryBuilder('datacenter')
            .innerJoinAndSelect(
                'datacenter.children',
                'system',
                'system.parent = datacenter.id AND system.idType=:systemType',
                { systemType: StorageEntityType.SYSTEM }
            )
            .leftJoinAndMapOne(
                'system.detail',
                StorageEntityDetailsEntity,
                'detail',
                'detail.id = system.id'
            )
            .innerJoinAndSelect(
                'system.children',
                'adapter',
                'adapter.idType=:adapterType',
                { adapterType: StorageEntityType.ADAPTER_GROUP }
            )
            .innerJoinAndSelect(
                'adapter.children',
                'port',
                'port.idType=:portType',
                { portType: StorageEntityType.PORT_GROUP }
            )
            .leftJoinAndMapMany(
                'port.metrics',
                PortMetricReadEntity,
                'port_metrics',
                'port_metrics.owner = port.id AND port_metrics.idType IN (:...portMetrics)',
                { portMetrics: metricTypes }
            )
            .leftJoinAndSelect(
                'port_metrics.metricTypeEntity',
                'portTypeEntity'
            )
            .leftJoinAndMapMany(
                'adapter.metrics',
                ChaMetricReadEntity,
                'adapter_metrics',
                'adapter_metrics.owner = adapter.id AND adapter_metrics.idType IN (:...metrics)',
                { metrics: metricTypes }
            )
            .leftJoinAndSelect(
                'adapter_metrics.metricTypeEntity',
                'adapterTypeEntity'
            )
            .where('adapter.idCatComponentStatus = :idStatus', {
                idStatus: StorageEntityStatus.ACTIVE,
            })
            .andWhere('system.idCatComponentStatus = :idSystemStatus', {
                idSystemStatus: StorageEntityStatus.ACTIVE,
            })
            .andWhere('port.idCatComponentStatus = :idPortStatus', {
                idPortStatus: StorageEntityStatus.ACTIVE,
            });
        if (idDataCenterParam.length > 0) {
            query.where('datacenter.id IN (:...idDatacenter)', {
                idDatacenter: idDataCenterParam,
            });
        }

        const datacenters = await query.getMany();

        const longPortGroupName = (portGroup: string) =>
            portGroup
                .split(',')
                .map((port) => `CL${port.slice(0, -1)}-${port.slice(-1)}`)
                .join(',');

        for (const datacenter of datacenters) {
            for (const system of datacenter.children) {
                // Is configured via a maintainer?
                if (this.maintainerService.handlesSystem(system.name)) {
                    await this.maintainerService.getMetricsForEntities(
                        system.name,
                        system.children, // AdapterGroups
                        (e) => e.name
                    );

                    await this.maintainerService.getMetricsForEntities(
                        system.name,
                        system.children.flatMap((c) => c.children), // PortGroups
                        (e) => longPortGroupName(e.name)
                    );
                }
            }
        }

        return datacenters;
    }

    async getHostGroupMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[]
    ): Promise<StorageEntityEntity[]> {
        const query = this.entityRepo
            .createQueryBuilder('datacenter')
            .innerJoinAndSelect(
                'datacenter.children',
                'system',
                'system.idType=:systemType',
                { systemType: StorageEntityType.SYSTEM }
            )
            .leftJoinAndMapOne(
                'system.detail',
                StorageEntityDetailsEntity,
                'detail',
                'detail.id = system.id'
            )
            .leftJoinAndSelect(
                'system.children',
                'hostGroup',
                'hostGroup.idType=:hostGroupType',
                { hostGroupType: StorageEntityType.HOST_GROUP }
            )
            .leftJoinAndMapMany(
                'hostGroup.metrics',
                HostGroupMetricReadEntity,
                'metrics',
                'metrics.owner = hostGroup.id AND metrics.idType IN (:...metrics)',
                { metrics: metricTypes }
            )
            .leftJoinAndSelect('metrics.metricTypeEntity', 'typeEntity')
            .leftJoinAndSelect('hostGroup.externals', 'external')
            .where('hostGroup.idCatComponentStatus = :idStatus', {
                idStatus: StorageEntityStatus.ACTIVE,
            })
            .andWhere('system.idCatComponentStatus = :idSystemStatus', {
                idSystemStatus: StorageEntityStatus.ACTIVE,
            });
        if (idDataCenterParam.length > 0) {
            query.andWhere('datacenter.id IN (:...idDatacenter)', {
                idDatacenter: idDataCenterParam,
            });
        }

        const datacenters = await query.getMany();

        for (const datacenter of datacenters) {
            for (const system of datacenter.children) {
                // Is configured via a maintainer?
                if (this.maintainerService.handlesSystem(system.name)) {
                    await this.maintainerService.getMetricsForEntities(
                        system.name,
                        system.children, // HostGroups
                        (e) => e.name,
                        {
                            metricNameTransform: (n) => 'VMW_' + n,
                        }
                    );
                }
            }
        }

        return datacenters;
    }

    private static resolveMetricTypes(
        metricGroup: MetricGroup,
        period?: PeriodType
    ): MetricType[] {
        let mapEntry = metricTypeMap[metricGroup][period ?? 'DAY'];

        if (!Array.isArray(mapEntry) || mapEntry.length === 0) {
            throw new BadRequestException(
                `Wrong metric group ${metricGroup} when resolving set of metric types`
            );
        }

        return mapEntry;
    }

    public async getPoolsById(
        poolIds: number[],
        orderBy: OrderByVo[],
        output: OutputType
    ): Promise<StorageEntityEntity[]> {
        let query;
        if (output === 'HIERARCHY') {
            query = this.entityRepo
                .createQueryBuilder('datacenter')
                .leftJoinAndSelect(
                    'datacenter.children',
                    'system',
                    'system.parent = datacenter.id AND system.idType=:systemType',
                    { systemType: StorageEntityType.SYSTEM }
                )
                .leftJoinAndSelect(
                    'system.children',
                    'pool',
                    'pool.idType=:poolType',
                    { poolType: StorageEntityType.POOL }
                );
        } else {
            query = this.entityRepo
                .createQueryBuilder('pool')
                .innerJoinAndSelect(
                    'pool.parent',
                    'system',
                    'system.id = pool.parent AND system.idType=:systemType AND system.idCatComponentStatus = :systemStatus',
                    {
                        systemType: StorageEntityType.SYSTEM,
                        systemStatus: StorageEntityStatus.ACTIVE,
                    }
                );
        }
        const result = await query
            .leftJoinAndMapMany(
                'pool.metrics',
                PoolMetricReadEntity,
                'metrics',
                'metrics.owner = pool.id'
            )
            .leftJoinAndSelect('pool.externals', 'external')
            .leftJoinAndSelect('metrics.metricTypeEntity', 'typeEntity')
            .andWhere(
                'pool.id IN (:...ids) AND pool.idCatComponentStatus = :poolStatus',
                { ids: poolIds, poolStatus: StorageEntityStatus.ACTIVE }
            )
            .getMany();
        let sortedResult: StorageEntityEntity[];
        if (!isEmpty(orderBy)) {
            sortedResult = SortStorageEntityByMetricUtils.sort(result, orderBy);
        } else {
            sortedResult = result;
        }
        return sortedResult;
    }

    public async getPoolMetricsByFilter(
        filter: StorageEntityFilterVo,
        output: OutputType
    ): Promise<StorageEntityEntity[]> {
        const query = this.entityRepo
            .createQueryBuilder('pool')
            .select('pool.id', 'id')
            .distinctOn(['pool.id'])
            .andWhere('pool.idType=:poolType', {
                poolType: StorageEntityType.POOL,
            })
            .orderBy('pool.id');
        if (!isEmpty(filter.referenceIds)) {
            query.innerJoin('pool.parent', 'system');
            query.andWhere('system.serialNumber IN (:...serialNumbers)', {
                serialNumbers: filter.referenceIds,
            });
        }
        if (!isEmpty(filter.tiers)) {
            query.innerJoinAndSelect('pool.externals', 'external');
            query.andWhere(
                'external.idType = :idType AND external.value IN (:...values)',
                { idType: ExternalType.TIER, values: filter.tiers }
            );
        }
        if (!isEmpty(filter.metricFilter)) {
            filter.metricFilter.forEach((filterItem) => {
                query.innerJoinAndMapMany(
                    `pool.metrics_${filterItem.type}`,
                    PoolMetricReadEntity,
                    `metrics_${filterItem.type}`,
                    `metrics_${filterItem.type}.owner = pool.id`
                );
                query.andWhere(
                    `(metrics_${filterItem.type}.idType = ${filterItem.type}
            AND metrics_${filterItem.type}.value ${filterItem.operator} ${filterItem.value})`
                );
            });
        }
        const distinctPools = await query.getRawMany();
        if (!isEmpty(distinctPools)) {
            const poolIds = distinctPools.map((pool) => pool.id);
            return this.getPoolsById(poolIds, filter.orderBy, output);
        }
        return [];
    }

    private getParityGroupsEvents(
        types: MetricType[],
        idDataCenterParam: number[],
        fromDate: string,
        toDate: string
    ) {
        const query = this.entityRepo
            .createQueryBuilder('datacenter')
            .innerJoinAndSelect(
                'datacenter.children',
                'system',
                'system.idType=:systemType',
                { systemType: StorageEntityType.SYSTEM }
            )
            .leftJoinAndMapOne(
                'system.detail',
                StorageEntityDetailsEntity,
                'detail',
                'detail.id = system.id'
            )
            .innerJoinAndSelect(
                'system.children',
                'pool',
                'pool.idType = :poolType',
                { poolType: StorageEntityType.POOL }
            )
            .leftJoinAndSelect(
                'pool.children',
                'parityGroup',
                'parityGroup.idType=:parityGroupType',
                { parityGroupType: StorageEntityType.PARITY_GROUP }
            )
            .leftJoinAndMapMany(
                'parityGroup.metrics',
                ParityGroupMetricEntity,
                'metrics',
                'metrics.owner = parityGroup.id AND metrics.idType IN (:...metrics)',
                { metrics: types }
            )
            .leftJoinAndSelect('metrics.metricTypeEntity', 'typeEntity')
            .where('parityGroup.idCatComponentStatus = :idStatus', {
                idStatus: StorageEntityStatus.ACTIVE,
            })
            .andWhere('system.idCatComponentStatus = :idSystemStatus', {
                idSystemStatus: StorageEntityStatus.ACTIVE,
            })
            .andWhere(
                'metrics.startTime >= :fromTime AND metrics.endTime <= :toTime',
                {
                    fromTime: new Date(parseInt(fromDate, 10)),
                    toTime: new Date(parseInt(toDate, 10)),
                }
            );
        if (idDataCenterParam.length > 0) {
            query.andWhere('datacenter.id IN (:...idDatacenter)', {
                idDatacenter: idDataCenterParam,
            });
        }
        return query.getMany();
    }
}
