import {
    Body,
    Controller,
    Param,
    Post,
    Put,
    UseInterceptors,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { MetricRequestDto } from '../dto/metric-request.dto';
import { CollectorType } from '../factory/collector-type.enum';
import { LoggingInterceptor } from '../../logging.interceptor';
import { MetricRequestPipe } from '../dto/pipes/metric-request-pipe.service';
import { MetricCollectorService } from '../services/collect/metric-collector.service';
import { MetricTransformer } from '../transformers/metric.transformer';
import { LatencyMetricTransformer } from '../transformers/latency-metric.transformer';
import { LatencyEntity } from '../entities/latency.entity';
import { MultiValueMetricCollectorService } from '../services/collect/multi-value-metric-collector.service';
import { AbstractMetricCollectorService } from '../services/collect/abstract-metric-collector.service';
import { ChangeStatusRequestDto } from '../dto/change-status-request.dto';
import { StorageEntityTransformer } from '../transformers/storage-entity.transformer';
import { StorageEntityService } from '../services/storage-entity.service';
import { StorageEntityResponseDto } from '../dto/storage-entity-response.dto';
import { StorageEntityStatusPipe } from '../dto/pipes/storage-entity-status.pipe';
import { StorageEntityKeyUtils } from '../utils/storage-entity-key.utils';
import { PgMultiValueMetricCollectorService } from '../services/collect/pg-multi-value-metric-collector.service';

export interface ComponentKey {
    parentName: string;
    grandParentName: string;
    childName: string;
}

@UseInterceptors(LoggingInterceptor)
@UsePipes(new ValidationPipe({ transform: true }))
@Controller('api/v1')
export class MetricController {
    constructor(
        private singleValueCollector: MetricCollectorService,
        private multiValueCollector: MultiValueMetricCollectorService,
        private pgMultiValueCollector: PgMultiValueMetricCollectorService,
        private storageEntityService: StorageEntityService
    ) {}

    @Post([
        ':subComponent/:systemName/metrics',
        'systems/:systemName/:subComponent/:subComponentName/metrics',
        'systems/:systemName/chas/:subComponentName/:subComponent/:portName/metrics',
    ])
    async insertSimpleMetric(
        @Param('systemName') systemName: string,
        @Param('subComponent') subComponentType: CollectorType,
        @Param('subComponentName') subComponentName: string,
        @Param('portName') portName: string,
        @Body(new MetricRequestPipe()) dto: MetricRequestDto
    ) {
        const metricEntity = await this.collectMetric(
            this.singleValueCollector,
            systemName,
            subComponentType,
            subComponentName,
            portName,
            dto
        );
        return MetricTransformer.transform(metricEntity[0]);
    }

    @Post('systems/:systemName/pools/:subComponentName/latencyPerBlockSize')
    async insertMultiValueMetric(
        @Param('systemName') systemName: string,
        @Param('subComponentName') subComponentName: string,
        @Body(new MetricRequestPipe()) dto: MetricRequestDto
    ) {
        const entities = await this.collectMetric(
            this.multiValueCollector,
            systemName,
            CollectorType.LATENCY,
            subComponentName,
            undefined,
            dto
        );
        return LatencyMetricTransformer.transform(
            entities as unknown as LatencyEntity[]
        );
    }

    async collectMetric(
        collector: AbstractMetricCollectorService,
        systemName: string,
        type,
        subComponentName,
        portName,
        dto
    ) {
        const componentKey = StorageEntityKeyUtils.createComponentKey(
            systemName,
            subComponentName,
            portName,
            StorageEntityKeyUtils.of(type)
        );
        return await collector.collectMetric(componentKey, dto);
    }

    @Put([
        ':subComponent/:systemName/status',
        'systems/:systemName/:subComponent/:subComponentName/status',
        'systems/:systemName/chas/:subComponentName/:subComponent/:portName/status',
    ])
    async changeStatus(
        @Param('systemName') systemName: string,
        @Param('subComponent') subComponentType: CollectorType,
        @Param('subComponentName') subComponentName: string,
        @Param('portName') portName: string,
        @Body(new StorageEntityStatusPipe()) dto: ChangeStatusRequestDto
    ): Promise<StorageEntityResponseDto> {
        const componentKey = StorageEntityKeyUtils.createComponentKey(
            systemName,
            subComponentName,
            portName,
            StorageEntityKeyUtils.of(subComponentType)
        );
        const storageEntity = await this.storageEntityService.updateStatus(
            componentKey,
            dto
        );
        return StorageEntityTransformer.transform(storageEntity);
    }

    @Post([
        'systems/:systemName/pools/:subComponentName/:subComponent/:portName/events',
    ])
    async insertParityGroupMetric(
        @Param('systemName') systemName: string,
        @Param('subComponent') subComponentType: CollectorType,
        @Param('subComponentName') poolName: string,
        @Param('portName') portName: string,
        @Body(new MetricRequestPipe()) dto: MetricRequestDto
    ) {
        const metricEntity = await this.collectMetric(
            this.pgMultiValueCollector,
            systemName,
            subComponentType,
            poolName,
            portName,
            dto
        );
        return MetricTransformer.transform(metricEntity[0]);
    }
}
