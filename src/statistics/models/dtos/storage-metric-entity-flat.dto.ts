import { ExternalResponseDto } from '../../../collector/dto/external-response.dto';
import { SystemMetric } from '../metrics/SystemMetric';
import { StorageEntityDetailResponseDto } from '../../../collector/dto/storage-entity-detail-response.dto';

import { StorageEntityMetricDto } from './storage-metric-entity-hierarchy.dto';

export class StorageMetricEntityFlatDto implements StorageEntityMetricDto {

  externals: ExternalResponseDto[];
  id: number;
  metrics: SystemMetric[];
  name: string;
  referenceId: string;
  status: string;
  type: string;
  detail: StorageEntityDetailResponseDto;
  parent: StorageMetricEntityFlatDto;
}
