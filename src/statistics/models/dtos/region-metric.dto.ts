import { Metric } from '../metrics/Metric';

import { Region } from './region.enum';

export class RegionMetricDto {
  region: Region;
  metrics: Metric[];
}
