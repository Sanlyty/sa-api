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
import { ParityGroupMetricEntity } from '../entities/parity-group-metric.entity';
import { StatisticParams } from '../../statistics/controllers/params/statistic.params';
import { MaintainerService } from './maintainer.service';
import metricTypeMap, { maintainerMetricMap } from './metric-type-map';

export const enum MetricGroup {
    PERFORMANCE = 1,
    CAPACITY = 2,
    ADAPTERS = 3,
    SLA = 4,
    HOST_GROUPS = 5,
    PARITY_GROUPS = 6,
}

const regionDataCenters = {
    [Region.EUROPE]: ['CZ_Chodov', 'CZ_Sitel'],
    [Region.ASIA]: ['MY_AIMS', 'MY_Cyberjaya'],
    [Region.AMERICA]: ['US_Ashburn', 'US_Mechanicsburg'], // , 'US_CVG'
};

@Injectable()
export class DataCenterService {
    constructor(
        private entityRepo: StorageEntityRepository,
        private maintainerService: MaintainerService
    ) {}

    findById = (id: number) =>
        this.entityRepo.find({
            where: { id },
        });

    findByName = (name: string) =>
        this.entityRepo.findOne({
            where: { name },
        });

    getDataCenterIdByRegion(region: Region): Promise<number[]> {
        const datacenters = regionDataCenters[region] ?? [];

        return Promise.all(
            datacenters.map((name) => this.findByName(name).then((d) => d?.id))
        );
    }

    getEmptyDatacenter = (idDcParam: number) => this.findById(idDcParam);
    getAllDataCenters = () => this.entityRepo.findDataCenters();

    getMetricsByGroup(
        metricGroup: MetricGroup,
        idDataCenter: number,
        period: PeriodType,
        statisticParams: StatisticParams
    ): Promise<StorageEntityEntity[]> {
        const fnMap = {
            [MetricGroup.PERFORMANCE]: this.getPerformanceMetrics,
            [MetricGroup.CAPACITY]: this.getPoolMetrics,
            [MetricGroup.SLA]: this.getPoolMetrics,
            [MetricGroup.ADAPTERS]: this.getChannelAdapterMetrics,
            [MetricGroup.HOST_GROUPS]: this.getHostGroupMetrics,
            [MetricGroup.PARITY_GROUPS]: this.getParityGroupsEvents,
        };

        if (metricGroup in fnMap) {
            return fnMap[metricGroup].call(
                this,
                DataCenterService.resolveMetricTypes(metricGroup, period),
                idDataCenter === undefined || idDataCenter === null
                    ? []
                    : [idDataCenter],
                metricGroup,
                period,
                statisticParams.fromDate,
                statisticParams.toDate
            );
        }

        // default return
        return this.getEmptyDatacenter(idDataCenter);
    }

    querySystems = (datacenters?: number[]) =>
        this.entityRepo.querySystems(datacenters);

    async getPerformanceMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[],
        metricGroup: MetricGroup,
        period: PeriodType
    ): Promise<StorageEntityEntity[]> {
        const query = this.querySystems(idDataCenterParam)
            .innerJoinAndMapMany(
                'system.metrics',
                SystemMetricReadEntity,
                'metrics',
                'metrics.owner = system.id AND metrics.idType IN (:...metrics)',
                { metrics: metricTypes }
            )
            .leftJoinAndSelect('metrics.metricTypeEntity', 'typeEntity');

        const datacenters = await query.getMany();

        for (const datacenter of datacenters) {
            for (const system of datacenter.children) {
                // Is configured via a maintainer?
                if (this.maintainerService.handlesSystem(system.name)) {
                    await this.maintainerService.getMetricsForEntities(
                        system.name,
                        [system],
                        () => 'average',
                        {
                            metrics: maintainerMetricMap[
                                MetricGroup.PERFORMANCE
                            ].map((m) => ({
                                ...m,
                                metric: `${m.metric ?? m.id}_${period}`,
                            })),
                            additionalKeys: { peak: () => 'peak' },
                        }
                    );
                }
            }
        }

        return datacenters;
    }

    async getPoolMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[],
        metricGroup: MetricGroup,
        period: PeriodType
    ): Promise<StorageEntityEntity[]> {
        const query = this.querySystems(idDataCenterParam)
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
            .andWhere('pool.idCatComponentStatus = :idStatus', {
                idStatus: StorageEntityStatus.ACTIVE,
            });

        const datacenters = await query.getMany();

        for (const system of datacenters.flatMap((d) => d.children)) {
            // Is configured via a maintainer?
            if (this.maintainerService.handlesSystem(system.name)) {
                if (metricGroup === MetricGroup.CAPACITY) {
                    await this.maintainerService.getMetricsForEntities(
                        system.name,
                        system.children, // Pools
                        (e) => e.serialNumber,
                        {
                            metrics: maintainerMetricMap[MetricGroup.CAPACITY],
                        }
                    );
                } else {
                    const now = new Date().getTime();
                    const days =
                        period === 'MONTH' ? 30 : period === 'WEEK' ? 7 : 1;
                    const sla = await this.maintainerService.getSLAEvents(
                        system.name,
                        now - days * 24 * 60 * 60_000,
                        now
                    );

                    system.children.forEach((c) => {
                        c.metrics = [
                            {
                                id: -1,
                                date: new Date(),
                                value: (sla[c.name]?.duration ?? 0) * 60,
                                metricTypeEntity: {
                                    id: -1,
                                    name: 'OUT_OF_SLA_TIME',
                                    unit: 'm',
                                    idCatMetricGroup: -1,
                                    threshold: undefined,
                                },
                            },
                            {
                                id: -1,
                                date: new Date(),
                                value: sla[c.name]?.count ?? 0,
                                metricTypeEntity: {
                                    id: -1,
                                    name: 'SLA_EVENTS',
                                    unit: '',
                                    idCatMetricGroup: -1,
                                    threshold: undefined,
                                },
                            },
                        ];
                    });
                }
            }
        }

        return datacenters;
    }

    async getChannelAdapterMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[],
        metricGroup: MetricGroup,
        period: PeriodType
    ): Promise<StorageEntityEntity[]> {
        const query = this.querySystems(idDataCenterParam)
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
            .andWhere('adapter.idCatComponentStatus = :idStatus', {
                idStatus: StorageEntityStatus.ACTIVE,
            })
            .andWhere('port.idCatComponentStatus = :idPortStatus', {
                idPortStatus: StorageEntityStatus.ACTIVE,
            });

        const datacenters = await query.getMany();

        const longPortGroupName = (portGroup: string) =>
            portGroup
                .split(',')
                .map((port) => `CL${port.slice(0, -1)}-${port.slice(-1)}`)
                .join(',');

        const appendPeriod = (metric: string) =>
            period !== 'DAY' ? `${metric}_${period}` : metric;

        const ABS_THRESHOLD = 20;
        const REL_THRESHOLD = 10;

        for (const datacenter of datacenters) {
            for (const system of datacenter.children) {
                // Is configured via a maintainer?
                if (this.maintainerService.handlesSystem(system.name)) {
                    await this.maintainerService.getMetricsForEntities(
                        system.name,
                        system.children, // AdapterGroups
                        (e) => e.name,
                        {
                            metrics: maintainerMetricMap.ADAPTER.map((m) => ({
                                ...m,
                                metric: appendPeriod(m.metric),
                            })),
                        }
                    );

                    // FIXME
                    system.children.forEach((adapterGroup) => {
                        const abs = adapterGroup.metrics.find(
                            (m) =>
                                m.metricTypeEntity.name === 'IMBALANCE_ABSOLUT'
                        )?.value;
                        const rel = adapterGroup.metrics.find(
                            (m) => m.metricTypeEntity.name === 'IMBALANCE_PERC'
                        )?.value;

                        if (abs < ABS_THRESHOLD || rel < REL_THRESHOLD) {
                            adapterGroup.metrics = [];
                        }
                    });

                    await this.maintainerService.getMetricsForEntities(
                        system.name,
                        system.children.flatMap((c) => c.children), // PortGroups
                        (e) => longPortGroupName(e.name),
                        {
                            metrics: maintainerMetricMap.ADAPTER_PORT.map(
                                (m) => ({
                                    ...m,
                                    metric: appendPeriod(m.metric),
                                })
                            ),
                        }
                    );

                    // FIXME
                    system.children
                        .flatMap((c) => c.children)
                        .forEach((portGroup) => {
                            const abs = portGroup.metrics.find(
                                (m) =>
                                    m.metricTypeEntity.name ===
                                    'PORT_IMBALANCE_ABSOLUT'
                            )?.value;
                            const rel = portGroup.metrics.find(
                                (m) =>
                                    m.metricTypeEntity.name ===
                                    'PORT_IMBALANCE_PERC'
                            )?.value;

                            if (abs < ABS_THRESHOLD || rel < REL_THRESHOLD) {
                                portGroup.metrics = [];
                            }
                        });
                }
            }
        }

        return datacenters;
    }

    async getHostGroupMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[]
    ): Promise<StorageEntityEntity[]> {
        const query = this.querySystems(idDataCenterParam)
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
            .andWhere('hostGroup.idCatComponentStatus = :idStatus', {
                idStatus: StorageEntityStatus.ACTIVE,
            });

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
                            metrics:
                                maintainerMetricMap[MetricGroup.HOST_GROUPS],
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
        const mapEntry = metricTypeMap[metricGroup][period ?? 'DAY'];

        if (!mapEntry?.length) {
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
            .where(
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

    private async getParityGroupsEvents(
        types: MetricType[],
        idDataCenterParam: number[],
        metricGroup: MetricGroup,
        period: PeriodType,
        fromDate: number,
        toDate: number
    ) {
        const query = this.querySystems(idDataCenterParam)
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
            .andWhere('parityGroup.idCatComponentStatus = :idStatus', {
                idStatus: StorageEntityStatus.ACTIVE,
            })
            .andWhere(
                '((metrics.startTime >= :fromTime AND metrics.endTime <= :toTime) OR system.name IN (:...maintained))',
                {
                    fromTime: new Date(Number(fromDate)),
                    toTime: new Date(Number(toDate)),
                    maintained: this.maintainerService.getHandledSystems(),
                }
            );

        const datacenters = await query.getMany();

        for (const datacenter of datacenters) {
            const yankedSystems = new Set();

            for (const system of datacenter.children) {
                // Is configured via a maintainer?
                if (this.maintainerService.handlesSystem(system.name)) {
                    let empty = true;

                    const data = await this.maintainerService.getPGEvents(
                        system.name,
                        Number(fromDate),
                        Number(toDate)
                    );

                    for (const pool of system.children) {
                        for (const parityGroup of pool.children) {
                            parityGroup.metrics = data.events
                                .filter(({ key }) => key === parityGroup.name)
                                .map((row) => ({
                                    id: -1,
                                    value: Math.round(10 * row.average) / 10,
                                    peak: Math.round(10 * row.peak) / 10,
                                    startTime: row.from,
                                    endTime: row.to,
                                    date: new Date(),
                                    metricTypeEntity: {
                                        id: -1,
                                        unit: '%',
                                        idCatMetricGroup: MetricType.HDD_PERC,
                                        name: 'HDD_PERC',
                                        threshold: undefined,
                                    },
                                }));

                            if (parityGroup.metrics.length > 0) {
                                empty = false;
                            }
                        }
                    }

                    if (empty) {
                        yankedSystems.add(system.id);
                    }
                }
            }

            datacenter.children = datacenter.children.filter(
                ({ id }) => !yankedSystems.has(id)
            );
        }

        return datacenters;
    }
}
