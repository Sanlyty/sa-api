import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';

import { OperationType } from '../../../collector/enums/operation-type.enum';
import {
    LatencyBlockSizeService,
    LatencyMetadata,
} from '../../services/latency-block-size.service';

import { LatencyRequestPipe } from './latency-request.pipe';

export interface LatencyFilter {
    poolIds: number[];
    dates: Date[];
    operations: OperationType[];
    latencies: number[];
    blockSizes: number[];
}

@Controller('api/v1/latency')
export class LatencyController {
    constructor(private readonly service: LatencyBlockSizeService) {}

    @Post('data')
    @HttpCode(HttpStatus.OK)
    public getData(@Body(LatencyRequestPipe) filter: LatencyFilter) {
        return this.service.frequencyByLatencyBlockSize(filter);
    }

    @Get('metadata')
    public async getMetadata(): Promise<LatencyMetadata> {
        return await this.service.getMetaData();
    }
}
