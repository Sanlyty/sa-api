import { Controller, Get, UseInterceptors } from '@nestjs/common';

import { LoggingInterceptor } from '../../logging.interceptor';
import { MaintainerService } from '../services/maintainer.service';

const PerfMetrics: string[] = [
    'WORKLOAD',
    'TRANSFER',
    'READ_RESPONSE',
    'WRITE_RESPONSE',
    'HDD',
    'CACHE_WP',
];

@Controller('api/v2/emc')
@UseInterceptors(LoggingInterceptor)
export class EmcController {
    constructor(private maintainers: MaintainerService) {}

    @Get('Performance')
    public async getPerformanceMetrics() {
        const result = [];

        for (const system of this.maintainers.getHandledSystems(['emc'])) {
            const entry = {
                name: system,
                metrics: [],
            };

            for (const metric of PerfMetrics) {
                const info = await this.maintainers.getDatasetInfo(
                    system,
                    metric
                );
                const response = await this.maintainers.getLastMaintainerData(
                    system,
                    metric
                );

                entry.metrics.push({
                    type: metric,
                    unit: info.units.replaceAll('percent', '%'),
                    value: response.cols['average'] ?? 0,
                    peak: (response.cols['peak'] ?? 0).toFixed(1),
                });
            }

            result.push(entry);
        }

        return result;
    }
}
