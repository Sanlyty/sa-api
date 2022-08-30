import {
    BadRequestException,
    Controller,
    Get,
    Param,
    Query,
    UseInterceptors,
} from '@nestjs/common';
import { LoggingInterceptor } from '../../logging.interceptor';
import { MaintainerService } from '../services/maintainer.service';

type QueryParams = Record<'from' | 'to', number | string | Date> & {
    map?: string;
    filter?: string;
};

const percRegex = /^perc-(\d+(?:\.\d+)?)$/;
const getMapFromQuery = (
    query: string,
    data: { variants: string[]; data: [number, ...number[]][] }
): ((data: number[]) => number) | undefined => {
    if (query === 'sum' || query === 'avg') {
        const factor = query === 'sum' ? 1 : data.variants.length;
        return (row) => row.reduce((prev, next) => prev + next, 0) / factor;
    }

    const m = percRegex.exec(query);
    if (m) {
        const perc = Number.parseFloat(m[1]);
        const n = Math.round(perc * (data.variants.length - 1));

        return (row) => row.sort((a, b) => a - b)[n];
    }

    return undefined;
};

const filterRegex = /^(top|bot)-(\d+)$/;

const getFilterFromQuery = (
    query: string,
    resp: { variants: string[]; data: [number, ...number[]][] }
): number[] | undefined => {
    const match = filterRegex.exec(query);

    if (match) {
        const factor = match[1] === 'top' ? -1 : 1;
        const order = resp.variants
            .map((_, i) => [i, resp.data.reduce((v, row) => v + row[i + 1], 0)])
            .sort(([, a], [, b]) => (a - b) * factor);

        return order.slice(0, Number.parseInt(match[2])).map(([i]) => i);
    }

    return undefined;
};

@Controller('api/v2/compat')
@UseInterceptors(LoggingInterceptor)
export class CompatibilityController {
    constructor(private maintainerService: MaintainerService) {}

    @Get(':systemName/ChbInfo')
    public async chbInfo(
        @Param('systemName') systemName
    ): Promise<ReturnType<MaintainerService['getChbInfo']>> {
        return await this.maintainerService.getChbInfo(systemName);
    }

    @Get(':systemName/ranges')
    public async getRanges(
        @Param('systemName') systemName
    ): Promise<[number, number][]> {
        console.log('yo');
        return await this.maintainerService.getRanges(systemName);
    }

    @Get(':systemName/:metricName')
    public async setExternals(
        @Param('systemName') systemName,
        @Param('metricName') metricName,
        @Query() qp: QueryParams
    ): Promise<{ variants: string[]; data: [number, ...number[]][] }> {
        if (!this.maintainerService.handlesSystem(systemName)) {
            throw new BadRequestException(
                "System doesn't exist or is not handled by a maintainer"
            );
        }

        const [from, to] = [qp.from, qp.to].map(
            (d) => new Date(Number.isNaN(Number(d)) ? d : Number(d))
        );

        let resp = await this.maintainerService.getMaintainerData(
            systemName,
            metricName,
            [from, to]
        );

        const filter = getFilterFromQuery(qp.filter, resp);

        if (filter) {
            resp = {
                variants: filter.map((i) => resp.variants[i]),
                data: resp.data.map(([key, ...data]) => [
                    key,
                    ...filter.map((i) => data[i]),
                ]),
            };
        }

        const map = getMapFromQuery(qp.map, resp);

        if (map) {
            return {
                variants: [qp.map],
                data: resp.data.map(([key, ...values]) => [key, map(values)]),
            };
        }

        return resp;
    }
}
