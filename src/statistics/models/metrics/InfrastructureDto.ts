import { RegionMetricDto } from '../dtos/region-metric.dto';

import { Alert } from './Alert';

export class InfrastructureDto {
  alerts: Alert[];
  metrics: RegionMetricDto[];
}
