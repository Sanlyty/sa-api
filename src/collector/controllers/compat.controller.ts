import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';

import prisma from '../../prisma';
import { ConfigService } from '../../config/config.service';
import { LoggingInterceptor } from '../../logging.interceptor';
import { StorageEntityType } from '../dto/owner.dto';
import { MaintainerCacheService } from '../services/maintainer-cache.service';
import { MaintainerService } from '../services/maintainer.service';

import {
    EMC_HOST_THRESHOLD_ABS,
    EMC_HOST_THRESHOLD_PERC,
} from './emc.controller';

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
    private feMode: Promise<unknown>;

    constructor(
        private maintainerService: MaintainerService,
        private maintainerCache: MaintainerCacheService,
        private config: ConfigService
    ) {
        this.feMode = Promise.resolve({ mode: config.getFeMode(), map: {} });
        this.maintainerService.loaded.then(() => {
            this.updateFeMode();
            this.maintainerService.events.on('updated', () => {
                this.updateFeMode();
            });
        });
    }

    private updateFeMode() {
        this.feMode = (async () => {
            const mode = this.config.getFeMode();
            const map: Record<string, string[]> = {};

            const systems = this.maintainerService.getHandledSystems([mode]);

            if (mode === 'hp') {
                for (const system of systems) {
                    const entity = await prisma.storageEntities.findFirst({
                        where: {
                            name: system,
                            id_cat_storage_entity_type:
                                StorageEntityType.SYSTEM,
                        },
                    });

                    if (!entity) continue;

                    const parent = await prisma.storageEntities.findUnique({
                        where: { id: entity.parentId },
                    });

                    const dc = parent?.name;
                    if (!dc) continue;

                    if (dc in map) {
                        map[dc].push(system);
                    } else {
                        map[dc] = [system];
                    }
                }
            } else {
                map['EMC'] = systems;
            }

            return {
                mode,
                map,
            };
        })();
    }

    @Get('FeMode')
    public async getFeMode() {
        return await this.feMode;
    }

    @Get(':systemName/VmwCapacity')
    public async vmwCapacity(
        @Param('systemName') systemName
    ): Promise<{ variant: string }[]> {
        return await this.maintainerCache.getVmws(systemName);
    }

    @Get(':systemName/HostInfo')
    public async hostInfo(
        @Param('systemName') systemName
    ): Promise<ReturnType<MaintainerService['getHostInfo']>> {
        return await this.maintainerService.getHostInfo(systemName);
    }

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

    @Get(':systemName/EmcHostEvents')
    public async getEmcHostEvents(
        @Param('systemName') system,
        @Query('from') from: Date,
        @Query('to') to: Date
    ) {
        from = new Date(Number(from));
        to = new Date(Number(to));

        const [, imbalance] = await this.maintainerService.getHostImbalance(
            system,
            [from, to]
        );

        return Object.fromEntries(
            Object.entries(imbalance).map(([k, [abs, rel]]) => {
                if (
                    rel < EMC_HOST_THRESHOLD_PERC ||
                    abs < EMC_HOST_THRESHOLD_ABS
                )
                    return [k, { warning: '' }];

                return [
                    k,
                    {
                        warning: `<span style="color: red">Imbalance ${(
                            rel * 100
                        ).toFixed(1)}% (${abs.toFixed(1)} [MB/s])</span>`,
                    },
                ];
            })
        );
    }

    @Get(':systemName/ranges')
    public async getRanges(
        @Param('systemName') systemName
    ): Promise<[number, number][]> {
        return (await this.maintainerService.getRanges(systemName)).map(
            (tuple) => tuple.map((d) => +d) as [number, number]
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
