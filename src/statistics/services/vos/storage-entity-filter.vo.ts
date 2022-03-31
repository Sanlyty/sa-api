import { FilterVo } from '../../../collector/services/filter.vo';
import { OrderByVo } from '../../utils/vo/order-by.vo';

export class StorageEntityFilterVo {
    metricFilter: FilterVo[];
    referenceIds: string[];
    tiers: string[];
    orderBy: OrderByVo[];
}
