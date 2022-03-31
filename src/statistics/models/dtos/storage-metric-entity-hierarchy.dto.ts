import { SystemMetric } from '../metrics/SystemMetric';
import { ExternalResponseDto } from '../../../collector/dto/external-response.dto';
import { StorageEntityDetailResponseDto } from '../../../collector/dto/storage-entity-detail-response.dto';

export interface StorageEntityMetricDto {
    id: number;
    name: string;
    type: string;
    status: string;
    referenceId: string;
    metrics: SystemMetric[];
    detail: StorageEntityDetailResponseDto;
    externals: ExternalResponseDto[];
}

export class StorageMetricEntityHierarchyDto implements StorageEntityMetricDto {
    id: number;
    name: string;
    type: string;
    status: string;
    referenceId: string;
    detail: StorageEntityDetailResponseDto;
    children: StorageMetricEntityHierarchyDto[];
    metrics: SystemMetric[];
    externals: ExternalResponseDto[];
}
