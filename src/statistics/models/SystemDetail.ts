import { SystemMetric } from './metrics/SystemMetric';
import { System } from './System';
import { ComponentExternal } from './ComponentExternal';

export class SystemDetail extends System {
    public metrics: SystemMetric[];
    public ports: SystemDetail[];
    public externals: ComponentExternal[];
}
