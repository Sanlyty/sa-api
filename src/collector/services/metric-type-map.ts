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

const multiply = (by: number) => (x: number) => by * x;
const roundToOrder = (order: number) => (x: number) =>
    Math.round(x * Math.pow(10, order)) / Math.pow(10, order);

type MaintainerMetricMap = Record<
    Exclude<MetricGroup, MetricGroup.ADAPTERS> | 'ADAPTER_PORT' | 'ADAPTER',
    {
        id: string;
        metric?: string;
        unit: string;
        type: MetricType;
        preproc?: (val: number) => number;
    }[]
>;
export const maintainerMetricMap: MaintainerMetricMap = {
    [MetricGroup.PERFORMANCE]: [
        {
            id: 'WORKLOAD',
            type: MetricType.WORKLOAD,
            unit: 'IOPS',
            preproc: Math.round,
        },
        {
            id: 'TRANSFER',
            type: MetricType.TRANSFER,
            unit: 'MBps',
            preproc: Math.round,
        },
        {
            id: 'RESPONSE',
            type: MetricType.RESPONSE,
            metric: 'RESPONSE_READ',
            unit: 'ms',
            preproc: roundToOrder(1),
        },
        {
            id: 'RESPONSE_WRITE',
            type: MetricType.RESPONSE,
            metric: 'RESPONSE_WRITE',
            unit: 'ms',
            preproc: roundToOrder(1),
        },
        { id: 'CPU_PERC', type: MetricType.CPU_PERC, unit: '%' },
        { id: 'HDD_PERC', type: MetricType.HDD_PERC, unit: '%' },
        {
            id: 'WRITE_PENDING_PERC',
            type: MetricType.WRITE_PENDING_PERC,
            unit: '%',
        },
    ],
    [MetricGroup.CAPACITY]: [
        {
            id: 'PHYSICAL_CAPACITY',
            type: MetricType.PHYSICAL_CAPACITY,
            unit: 'TB',
        },
        {
            id: 'PHYSICAL_SUBS_PERC',
            type: MetricType.PHYSICAL_SUBS_PERC,
            unit: '%',
        },
        {
            id: 'AVAILABLE_CAPACITY',
            type: MetricType.AVAILABLE_CAPACITY,
            unit: 'TB',
        },
        {
            id: 'LOGICAL_USED_PERC',
            type: MetricType.LOGICAL_USED_PERC,
            unit: '%',
        },
        {
            id: 'PHYSICAL_USED_PERC',
            type: MetricType.PHYSICAL_USED_PERC,
            unit: '%',
        },
        {
            id: 'COMPRESSION_RATIO',
            type: MetricType.COMPRESSION_RATIO,
            unit: '',
        },
        { id: 'PREDICTION_L1', type: MetricType.PREDICTION_L1, unit: 'days' },
        { id: 'PREDICTION_L2', type: MetricType.PREDICTION_L2, unit: 'days' },
        { id: 'PREDICTION_L3', type: MetricType.PREDICTION_L3, unit: 'days' },
        {
            id: 'CHANGE_DAY',
            type: MetricType.CHANGE_DAY,
            unit: 'GB',
            metric: 'PHYSICAL_USED_DAY',
            preproc: multiply(1024),
        },
        {
            id: 'CHANGE_WEEK',
            type: MetricType.CHANGE_WEEK,
            unit: 'GB',
            metric: 'PHYSICAL_USED_WEEK',
            preproc: multiply(1024),
        },
        {
            id: 'CHANGE_MONTH',
            type: MetricType.CHANGE_MONTH,
            unit: 'GB',
            metric: 'PHYSICAL_USED_MONTH',
            preproc: multiply(1024),
        },
        { id: 'PHYSICAL_USED', type: MetricType.PHYSICAL_USED, unit: 'TB' },
        {
            id: 'PHYSICAL_FREE',
            type: MetricType.PHYSICAL_FREE,
            metric: 'AVAILABLE_CAPACITY',
            unit: 'TB',
        },
        {
            id: 'LOGICAL_CAPACITY',
            type: MetricType.LOGICAL_CAPACITY,
            unit: 'TB',
        },
        { id: 'LOGICAL_USED', type: MetricType.LOGICAL_USED, unit: 'TB' },
        { id: 'LOGICAL_FREE', type: MetricType.LOGICAL_FREE, unit: 'TB' },
        { id: 'NET_TOTAL', type: MetricType.NET_TOTAL, unit: 'TB' },
        { id: 'NET_USED', type: MetricType.NET_USED, unit: 'TB' },
        { id: 'NET_FREE', type: MetricType.NET_FREE, unit: 'TB' },
        {
            id: 'PHY_USED_BEF_SAVING',
            type: MetricType.PHY_USED_BEF_SAVING,
            unit: 'GB',
        },
        { id: 'DEDUP_RATIO', type: MetricType.DEDUP_RATIO, unit: '' },
        {
            id: 'TOTAL_SAVING_EFFECT',
            type: MetricType.TOTAL_SAVING_EFFECT,
            unit: '',
        },
        {
            id: 'SUBSCRIBED_CAPACITY',
            type: MetricType.SUBSCRIBED_CAPACITY,
            unit: 'TB',
        },
        {
            id: 'LOGICAL_SUBS_PERC',
            type: MetricType.LOGICAL_CAPACITY,
            unit: '%',
        },
        { id: 'NET_SUBS_PERC', type: MetricType.NET_SUBS_PERC, unit: '%' },
        { id: 'NET_USED_PERC', type: MetricType.NET_USED_PERC, unit: '%' },
    ],
    [MetricGroup.SLA]: [
        { id: 'SLA_EVENTS', type: MetricType.SLA_EVENTS, unit: '' },
        { id: 'OUT_OF_SLA_TIME', type: MetricType.OUT_OF_SLA_TIME, unit: 's' },
    ],
    ADAPTER: [
        {
            id: 'IMBALANCE_EVENTS',
            type: MetricType.IMBALANCE_EVENTS,
            metric: 'CHANNEL_IMBALANCES_COUNT',
            unit: '',
        },
        {
            id: 'IMBALANCE_ABSOLUT',
            type: MetricType.IMBALANCE_ABSOLUT,
            metric: 'CHANNEL_IMBALANCES',
            unit: 'MBps',
            preproc: (x) => Math.round((10 * x) / 1024) / 10,
        },
        {
            id: 'IMBALANCE_PERC',
            type: MetricType.IMBALANCE_PERC,
            metric: 'CHANNEL_IMBALANCES_PERC',
            unit: '%',
            preproc: roundToOrder(1),
        },
    ],
    ADAPTER_PORT: [
        {
            id: 'PORT_IMBALANCE_EVENTS',
            type: MetricType.PORT_IMBALANCE_EVENTS,
            metric: 'PORT_IMBALANCES_COUNT',
            unit: '',
        },
        {
            id: 'PORT_IMBALANCE_ABSOLUT',
            type: MetricType.PORT_IMBALANCE_ABSOLUT,
            metric: 'PORT_IMBALANCES',
            unit: 'MBps',
            preproc: (x) => Math.round((10 * x) / 1024) / 10,
        },
        {
            id: 'PORT_IMBALANCE_PERC',
            type: MetricType.PORT_IMBALANCE_PERC,
            metric: 'PORT_IMBALANCES_PERC',
            unit: '%',
            preproc: roundToOrder(1),
        },
    ],
    [MetricGroup.HOST_GROUPS]: [
        {
            id: 'NET_TOTAL',
            type: MetricType.NET_TOTAL,
            metric: 'VMW_NET_TOTAL',
            unit: 'TB',
        },
        {
            id: 'NET_USED',
            type: MetricType.NET_USED,
            metric: 'VMW_NET_USED',
            unit: 'TB',
        },
        {
            id: 'NET_USED_PERC',
            type: MetricType.NET_USED_PERC,
            metric: 'VMW_NET_USED_PERC',
            unit: '%',
        },
        {
            id: 'CHANGE_DAY',
            type: MetricType.CHANGE_DAY,
            metric: 'VMW_NET_USED_DAY',
            unit: 'GB',
            preproc: multiply(1024),
        },
        {
            id: 'CHANGE_WEEK',
            type: MetricType.CHANGE_WEEK,
            metric: 'VMW_NET_USED_WEEK',
            unit: 'GB',
            preproc: multiply(1024),
        },
        {
            id: 'CHANGE_MONTH',
            type: MetricType.CHANGE_MONTH,
            metric: 'VMW_NET_USED_MONTH',
            unit: 'GB',
            preproc: multiply(1024),
        },
    ],
    [MetricGroup.PARITY_GROUPS]: [
        { id: 'HDD_PERC', type: MetricType.HDD_PERC, unit: '%' },
    ],
};

export default metricTypeMap;
