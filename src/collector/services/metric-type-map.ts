import { MetricType } from '../enums/metric-type.enum';
import { MetricGroup } from './data-center.service';
import { PeriodType } from '../enums/period-type.enum';

type MetricTypeMap = Record<MetricGroup, Record<PeriodType, MetricType[]>>;

const metricTypeMap: MetricTypeMap = {
    [MetricGroup.PERFORMANCE]: {
        DAY: [
            MetricType.WORKLOAD,
            MetricType.TRANSFER,
            MetricType.RESPONSE,
            MetricType.CPU_PERC,
            MetricType.HDD_PERC,
            MetricType.WRITE_PENDING_PERC,
        ],
        WEEK: [
            MetricType.WORKLOAD_WEEK,
            MetricType.TRANSFER_WEEK,
            MetricType.RESPONSE_WEEK,
            MetricType.CPU_PERC_WEEK,
            MetricType.HDD_PERC_WEEK,
            MetricType.WRITE_PENDING_PERC_WEEK,
        ],
        MONTH: [
            MetricType.WORKLOAD_MONTH,
            MetricType.TRANSFER_MONTH,
            MetricType.RESPONSE_MONTH,
            MetricType.CPU_PERC_MONTH,
            MetricType.HDD_PERC_MONTH,
            MetricType.WRITE_PENDING_PERC_MONTH,
        ],
    },
    [MetricGroup.CAPACITY]: {
        DAY: [
            MetricType.PHYSICAL_CAPACITY,
            MetricType.PHYSICAL_SUBS_PERC,
            MetricType.AVAILABLE_CAPACITY,
            MetricType.LOGICAL_USED_PERC,
            MetricType.PHYSICAL_USED_PERC,
            MetricType.COMPRESSION_RATIO,
            MetricType.CHANGE_DAY,
            MetricType.CHANGE_MONTH,
            MetricType.CHANGE_WEEK,
            MetricType.PREDICTION_L1,
            MetricType.PREDICTION_L2,
            MetricType.PREDICTION_L3,
            MetricType.CHANGE_DAY,
            MetricType.CHANGE_WEEK,
            MetricType.CHANGE_MONTH,
            MetricType.PHYSICAL_USED,
            MetricType.PHYSICAL_FREE,
            MetricType.LOGICAL_CAPACITY,
            MetricType.LOGICAL_USED,
            MetricType.LOGICAL_FREE,
            MetricType.NET_TOTAL,
            MetricType.NET_USED,
            MetricType.NET_FREE,
            MetricType.PHY_USED_BEF_SAVING,
            MetricType.DEDUP_RATIO,
            MetricType.TOTAL_SAVING_EFFECT,
            MetricType.SUBSCRIBED_CAPACITY,
            MetricType.LOGICAL_SUBS_PERC,
            MetricType.NET_SUBS_PERC,
            MetricType.NET_USED_PERC,
        ],
        WEEK: [],
        MONTH: [],
    },
    [MetricGroup.ADAPTERS]: {
        DAY: [
            MetricType.IMBALANCE_EVENTS,
            MetricType.IMBALANCE_ABSOLUT,
            MetricType.IMBALANCE_PERC,
            MetricType.PORT_IMBALANCE_EVENTS,
            MetricType.PORT_IMBALANCE_ABSOLUT,
            MetricType.PORT_IMBALANCE_PERC,
        ],
        WEEK: [
            MetricType.IMBALANCE_EVENTS_WEEK,
            MetricType.IMBALANCE_ABSOLUT_WEEK,
            MetricType.IMBALANCE_PERC_WEEK,
            MetricType.PORT_IMBALANCE_EVENTS_WEEK,
            MetricType.PORT_IMBALANCE_ABSOLUT_WEEK,
            MetricType.PORT_IMBALANCE_PERC_WEEK,
        ],
        MONTH: [
            MetricType.IMBALANCE_EVENTS_MONTH,
            MetricType.IMBALANCE_ABSOLUT_MONTH,
            MetricType.IMBALANCE_PERC_MONTH,
            MetricType.PORT_IMBALANCE_EVENTS_MONTH,
            MetricType.PORT_IMBALANCE_ABSOLUT_MONTH,
            MetricType.PORT_IMBALANCE_PERC_MONTH,
        ],
    },
    [MetricGroup.SLA]: {
        DAY: [MetricType.SLA_EVENTS, MetricType.OUT_OF_SLA_TIME],
        WEEK: [MetricType.SLA_EVENTS_WEEK, MetricType.OUT_OF_SLA_TIME_WEEK],
        MONTH: [MetricType.SLA_EVENTS_MONTH, MetricType.OUT_OF_SLA_TIME_MONTH],
    },
    [MetricGroup.HOST_GROUPS]: {
        DAY: [
            MetricType.NET_TOTAL,
            MetricType.NET_USED,
            MetricType.NET_USED_PERC,
            MetricType.CHANGE_DAY,
            MetricType.CHANGE_WEEK,
            MetricType.CHANGE_MONTH,
        ],
        WEEK: [],
        MONTH: [],
    },
    [MetricGroup.PARITY_GROUPS]: {
        DAY: [MetricType.HDD_PERC],
        WEEK: [],
        MONTH: [],
    },
};

export default metricTypeMap;
