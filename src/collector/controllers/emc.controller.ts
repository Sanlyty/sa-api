import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';

import { LoggingInterceptor } from '../../logging.interceptor';
import { PeriodType } from '../enums/period-type.enum';
import { MaintainerService } from '../services/maintainer.service';
import { VMwareService } from '../services/vmware.service';

const PerfMetrics: string[] = [
    'WORKLOAD',
    'TRANSFER',
    'READ_RESPONSE',
    'WRITE_RESPONSE',
    'CPU',
    'HDD',
    'CACHE_WP',
];

const CapMetrics: string[] = [
    'SUBSCRIBED_CAPACITY',
    'SUBSCRIBED_CAPACITY_PERC',
    'PHYSICAL_TOTAL',
    'PHYSICAL_USED',
    'PHYSICAL_FREE',
    'PHYSICAL_USED_PERC',
    'NET_TOTAL',
    'NET_USED',
    'NET_FREE',
    'COMPRESSION_RATIO',
    'PHYSICAL_USED_DAY',
    'PHYSICAL_USED_WEEK',
    'PHYSICAL_USED_MONTH',
];

const unitMap = {
    percent: '%',
    '1': '',
};

@Controller('api/v2/emc')
@UseInterceptors(LoggingInterceptor)
export class EmcController {
    constructor(
        private maintainers: MaintainerService,
        private vmware: VMwareService
    ) {}

    @Get('Performance')
    public async getPerformanceMetrics(@Query('period') period: PeriodType) {
        const result = [];

        const suffix = period ? `_${period}` : '';

        for (const system of this.maintainers.getHandledSystems(['emc'])) {
            const entry = {
                name: system,
                metrics: [],
            };

            for (const metric of PerfMetrics) {
                const info = await this.maintainers.getDatasetInfo(
                    system,
                    metric + suffix
                );
                const response = await this.maintainers.getLastMaintainerData(
                    system,
                    metric + suffix
                );

                entry.metrics.push({
                    type: metric,
                    date: response.date,
                    unit: unitMap[info.units] ?? info.units,
                    value: response.cols['average'] ?? 0,
                    peak: (response.cols['peak'] ?? 0).toFixed(1),
                });
            }

            result.push(entry);
        }

        return result;
    }

    @Get('Capacity')
    public async getCapacityMetrics() {
        const result = [];

        for (const system of this.maintainers.getHandledSystems(['emc'])) {
            const entry = {
                name: system,
                metrics: [],
                children: [],
            };

            for (const metric of CapMetrics) {
                let { units } = {
                    ...(await this.maintainers.getDatasetInfo(system, metric)),
                };
                const response = await this.maintainers.getLastMaintainerData(
                    system,
                    metric
                );

                if (!metric.startsWith('PHYSICAL_USED_') && units === 'GB') {
                    response.cols['average'] /= 1024;
                    units = 'TB';
                }

                entry.metrics.push({
                    type: metric,
                    date: response.date,
                    unit: unitMap[units] ?? units,
                    value: response.cols['average'] ?? 0,
                });
            }

            result.push(entry);
        }

        return result;
    }

    @Get('VMware')
    public async getVMwareMetrics() {
        return this.vmware.getData();
    }
}
