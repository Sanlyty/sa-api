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

export enum MetricGroup {
    PERFORMANCE = 1,
    CAPACITY = 2,
    ADAPTERS = 3,
    SLA = 4,
    HOST_GROUPS = 5,
    PARITY_GROUPS = 6,
}

@Injectable()
export class DataCenterService {
    private readonly regionDataCenters = [];

    constructor(private storageEntityRepository: StorageEntityRepository) {
        this.regionDataCenters.push({
            type: Region.EUROPE,
            datacenterName: ['CZ_Chodov', 'CZ_Sitel'],
        });
        this.regionDataCenters.push({
            type: Region.ASIA,
            datacenterName: ['MY_AIMS', 'MY_Cyberjaya'],
        });
        this.regionDataCenters.push({
            type: Region.AMERICA,
            datacenterName: ['US_Ashburn', 'US_Mechanicsburg'],
        });
    }

    async findById(idDataCenter: number): Promise<StorageEntityEntity[]> {
        return await this.storageEntityRepository.find({
            where: { id: idDataCenter },
        });
    }

    async findByName(dcName: string): Promise<StorageEntityEntity> {
        return await this.storageEntityRepository.findOne({
            where: { name: dcName },
        });
    }

    async getDataCenterIdByRegion(region: Region): Promise<number[]> {
        const foundItem = this.regionDataCenters.find(
            (regionMapItem) => regionMapItem.type === region
        );
        if (foundItem != null) {
            return await Promise.all(
                foundItem.datacenterName.map(async (dataCenterName) => {
                    const dc = await this.findByName(dataCenterName);
                    if (dc !== undefined) {
                        return dc.id;
                    }
                })
            );
        }
        return [];
    }

    async getMetricsByGroup(
        metricGroup: MetricGroup,
        idDataCenter: number,
        period: PeriodType,
        statisticParams: StatisticParams
    ): Promise<StorageEntityEntity[]> {
        const dcDao = await this.loadMetrics(
            metricGroup,
            idDataCenter,
            period,
            statisticParams
        );
        return dcDao || (await this.getEmptyDatacenter(idDataCenter));
    }

    async getPerformanceMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[]
    ): Promise<StorageEntityEntity[]> {
        const query = this.storageEntityRepository
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

        return query.getMany();
    }

    async getPoolMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[]
    ): Promise<StorageEntityEntity[]> {
        const query = this.storageEntityRepository
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
        return await query.getMany();
    }

    getChannelAdapterMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[]
    ): Promise<StorageEntityEntity[]> {
        const query = this.storageEntityRepository
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
        return query.getMany();
    }

    getHostGroupMetrics(
        metricTypes: MetricType[],
        idDataCenterParam: number[]
    ): Promise<StorageEntityEntity[]> {
        const query = this.storageEntityRepository
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

        return query.getMany();
    }

    getEmptyDatacenter(
        idDataCenterParam: number
    ): Promise<StorageEntityEntity[]> {
        return this.findById(idDataCenterParam);
    }

    async getAllDataCenters(): Promise<StorageEntityEntity[]> {
        return await this.storageEntityRepository.findDataCenters();
    }

    private loadMetrics(
        metricGroup: MetricGroup,
        idDataCenter: number,
        period: PeriodType,
        statisticParams: StatisticParams
    ): Promise<StorageEntityEntity[]> {
        const types: MetricType[] = DataCenterService.resolveMetricTypes(
            metricGroup,
            period
        );
        let dataCenterIds = [];
        if (idDataCenter !== null && idDataCenter !== undefined) {
            dataCenterIds = [idDataCenter];
        }
        switch (metricGroup) {
            case MetricGroup.PERFORMANCE:
                return this.getPerformanceMetrics(types, dataCenterIds);
            case MetricGroup.CAPACITY:
                return this.getPoolMetrics(types, dataCenterIds);
            case MetricGroup.ADAPTERS:
                return this.getChannelAdapterMetrics(types, dataCenterIds);
            case MetricGroup.SLA:
                return this.getPoolMetrics(types, dataCenterIds);
            case MetricGroup.HOST_GROUPS:
                return this.getHostGroupMetrics(types, dataCenterIds);
            case MetricGroup.PARITY_GROUPS:
                return this.getParityGroupsEvents(
                    types,
                    dataCenterIds,
                    statisticParams.fromDate.toString(),
                    statisticParams.toDate.toString()
                );
        }
    }

    private static resolveMetricTypes(
        metricGroup: MetricGroup,
        period: PeriodType
    ): MetricType[] {
        let periodType = period;
        if (period == null) {
            periodType = PeriodType.DAY;
        }
        const metrics = [];
        metrics[MetricGroup.PERFORMANCE] = [];
        metrics[MetricGroup.PERFORMANCE][PeriodType.DAY] = [
            MetricType.WORKLOAD,
            MetricType.TRANSFER,
            MetricType.RESPONSE,
            MetricType.CPU_PERC,
            MetricType.HDD_PERC,
            MetricType.WRITE_PENDING_PERC,
        ];
        metrics[MetricGroup.PERFORMANCE][PeriodType.MONTH] = [
            MetricType.WORKLOAD_MONTH,
            MetricType.TRANSFER_MONTH,
            MetricType.RESPONSE_MONTH,
            MetricType.CPU_PERC_MONTH,
            MetricType.HDD_PERC_MONTH,
            MetricType.WRITE_PENDING_PERC_MONTH,
        ];
        metrics[MetricGroup.PERFORMANCE][PeriodType.WEEK] = [
            MetricType.WORKLOAD_WEEK,
            MetricType.TRANSFER_WEEK,
            MetricType.RESPONSE_WEEK,
            MetricType.CPU_PERC_WEEK,
            MetricType.HDD_PERC_WEEK,
            MetricType.WRITE_PENDING_PERC_WEEK,
        ];
        metrics[MetricGroup.CAPACITY] = [];
        metrics[MetricGroup.CAPACITY][PeriodType.DAY] = [
            MetricType.PHYSICAL_CAPACITY,
            MetricType.PHYSICAL_SUBS_PERC,
            MetricType.AVAILABLE_CAPACITY,
            MetricType.LOGICAL_USED_PERC,
            MetricType.PHYSICAL_USED_PERC,
            MetricType.COMPRESSION_RATIO,
            MetricType.CHANGE_DAY,
            MetricType.CHANGE_MONTH,
            MetricType.CHANGE_WEEK,
            MetricType.PREDICTION_L1,
            MetricType.PREDICTION_L2,
            MetricType.PREDICTION_L3,
            MetricType.CHANGE_DAY,
            MetricType.CHANGE_WEEK,
            MetricType.CHANGE_MONTH,
            MetricType.PHYSICAL_USED,
            MetricType.PHYSICAL_FREE,
            MetricType.LOGICAL_CAPACITY,
            MetricType.LOGICAL_USED,
            MetricType.LOGICAL_FREE,
            MetricType.NET_TOTAL,
            MetricType.NET_USED,
            MetricType.NET_FREE,
            MetricType.PHY_USED_BEF_SAVING,
            MetricType.DEDUP_RATIO,
            MetricType.TOTAL_SAVING_EFFECT,
            MetricType.SUBSCRIBED_CAPACITY,
            MetricType.LOGICAL_SUBS_PERC,
            MetricType.NET_SUBS_PERC,
            MetricType.NET_USED_PERC,
        ];
        metrics[MetricGroup.ADAPTERS] = [];
        metrics[MetricGroup.ADAPTERS][PeriodType.DAY] = [
            MetricType.IMBALANCE_EVENTS,
            MetricType.IMBALANCE_ABSOLUT,
            MetricType.IMBALANCE_PERC,
            MetricType.PORT_IMBALANCE_EVENTS,
            MetricType.PORT_IMBALANCE_ABSOLUT,
            MetricType.PORT_IMBALANCE_PERC,
        ];
        metrics[MetricGroup.ADAPTERS][PeriodType.WEEK] = [
            MetricType.IMBALANCE_EVENTS_WEEK,
            MetricType.IMBALANCE_ABSOLUT_WEEK,
            MetricType.IMBALANCE_PERC_WEEK,
            MetricType.PORT_IMBALANCE_EVENTS_WEEK,
            MetricType.PORT_IMBALANCE_ABSOLUT_WEEK,
            MetricType.PORT_IMBALANCE_PERC_WEEK,
        ];
        metrics[MetricGroup.ADAPTERS][PeriodType.MONTH] = [
            MetricType.IMBALANCE_EVENTS_MONTH,
            MetricType.IMBALANCE_ABSOLUT_MONTH,
            MetricType.IMBALANCE_PERC_MONTH,
            MetricType.PORT_IMBALANCE_EVENTS_MONTH,
            MetricType.PORT_IMBALANCE_ABSOLUT_MONTH,
            MetricType.PORT_IMBALANCE_PERC_MONTH,
        ];
        metrics[MetricGroup.SLA] = [];
        metrics[MetricGroup.SLA][PeriodType.DAY] = [
            MetricType.SLA_EVENTS,
            MetricType.OUT_OF_SLA_TIME,
        ];
        metrics[MetricGroup.SLA][PeriodType.WEEK] = [
            MetricType.SLA_EVENTS_WEEK,
            MetricType.OUT_OF_SLA_TIME_WEEK,
        ];
        metrics[MetricGroup.SLA][PeriodType.MONTH] = [
            MetricType.SLA_EVENTS_MONTH,
            MetricType.OUT_OF_SLA_TIME_MONTH,
        ];
        metrics[MetricGroup.HOST_GROUPS] = [];
        metrics[MetricGroup.HOST_GROUPS][PeriodType.DAY] = [
            MetricType.NET_TOTAL,
            MetricType.NET_USED,
            MetricType.NET_USED_PERC,
            MetricType.CHANGE_DAY,
            MetricType.CHANGE_WEEK,
            MetricType.CHANGE_MONTH,
        ];
        metrics[MetricGroup.PARITY_GROUPS] = [];
        metrics[MetricGroup.PARITY_GROUPS][PeriodType.DAY] = [
            MetricType.HDD_PERC,
        ];
        if (metrics[metricGroup][periodType] == null) {
            throw new BadRequestException(
                `Wrong metric group ${metricGroup} when resolving set of metric types`
            );
        }
        return metrics[metricGroup][periodType];
    }

    public async getPoolsById(
        poolIds: number[],
        orderBy: OrderByVo[],
        output: OutputType
    ): Promise<StorageEntityEntity[]> {
        let query;
        if (output === 'HIERARCHY') {
            query = this.storageEntityRepository
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
            query = this.storageEntityRepository
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
        const query = this.storageEntityRepository
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
        const query = this.storageEntityRepository
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
