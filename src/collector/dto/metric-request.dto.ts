import { MetricType } from '../enums/metric-type.enum';
import { OperationType } from '../enums/operation-type.enum';

import { LatencyRequestDto } from './latency-request.dto';
import { ParityGroupMetricRequestDto } from './parity-group-metric-request.dto';

export class MetricRequestDto {

  readonly metricType: MetricType;

  readonly value: number;

  // @IsValidDate({ message: 'Date \'$value\' is not valid date value or it is in the future' })
  readonly date: Date;

  readonly peak: number;

  readonly data: LatencyRequestDto[] | ParityGroupMetricRequestDto[];

  readonly operation: OperationType;

}
