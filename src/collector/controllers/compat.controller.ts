import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../../logging.interceptor';
import { MaintainerCacheService } from '../services/maintainer-cache.service';
import { MaintainerService } from '../services/maintainer.service';

type QueryParams = Record<'from' | 'to', number | string | Date> & {
    map?: string;
    filter?: string;
};

export type MaintainerDataResponse = {
    variants: string[];
    units: string;
    data: [number, ...number[]][];
};

@Controller('api/v2/compat')
@UseInterceptors(LoggingInterceptor)
export class CompatibilityController {
    constructor(
        private maintainerService: MaintainerService,
        private maintainerCache: MaintainerCacheService
    ) {}

    @Get(':systemName/ChbInfo')
    public async chbInfo(
        @Param('systemName') systemName
    ): Promise<ReturnType<MaintainerService['getChbInfo']>> {
        return await this.maintainerService.getChbInfo(systemName);
    }

    @Get(':systemName/PoolInfo')
    public async poolInfo(
        @Param('systemName') systemName
    ): Promise<ReturnType<MaintainerService['getPoolInfo']>> {
        return await this.maintainerService.getPoolInfo(systemName);
    }

    @Get(':systemName/FePorts')
    public async fePorts(
        @Param('systemName') systemName
    ): Promise<ReturnType<MaintainerService['getFePorts']>> {
        return await this.maintainerService.getFePorts(systemName);
    }

    @Get(':systemName/ranges')
    public async getRanges(
        @Param('systemName') systemName
    ): Promise<[number, number][]> {
        return (await this.maintainerService.getRanges(systemName)).map(
            (tuple) => tuple.map((d) => d * 60_000) as [number, number]
        );
    }

    @Get(':systemName/:metricName')
    public async getMaintainerData(
        @Param('systemName') system,
        @Param('metricName') metric,
        @Query() qp: QueryParams
    ): Promise<MaintainerDataResponse> {
        const range = [qp.from, qp.to].map(
            (d) => new Date(Number.isNaN(Number(d)) ? d : Number(d))
        ) as [Date, Date];

        return this.maintainerCache.getData(system, metric, range, qp);
    }
}
