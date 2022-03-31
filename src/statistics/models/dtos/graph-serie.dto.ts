import { SystemMetricType } from '../metrics/SystemMetricType';

export class GraphSerie {
    constructor(
        public type: SystemMetricType,
        public data: { x: any; y: any }[]
    ) {}
}
