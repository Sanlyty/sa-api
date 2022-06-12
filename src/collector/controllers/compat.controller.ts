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

type QueryParams = Record<'from' | 'to', number | string | Date>;

@Controller('api/v2/compat')
@UseInterceptors(LoggingInterceptor)
export class CompatibilityController {
    constructor(private maintainerService: MaintainerService) {}

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

        const data = await this.maintainerService.getMaintainerData(
            systemName,
            metricName,
            [from, to]
        );

        return data;
    }
}
