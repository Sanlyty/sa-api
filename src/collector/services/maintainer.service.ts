import { Injectable, HttpService } from '@nestjs/common';
import { readFileSync } from 'fs';

const metricNameMap: Record<string, string> = {
    RESPONSE: 'RESPONSE_READ_DAY',
    RESPONSE_WEEK: 'RESPONSE_READ_WEEK',
    RESPONSE_MONTH: 'RESPONSE_READ_MONTH',

    CHANGE_DAY: 'PHYSICAL_CAPACITY_DAY',
    CHANGE_WEEK: 'PHYSICAL_CAPACITY_WEEK',
    CHANGE_MONTH: 'PHYSICAL_CAPACITY_MONTH',

    PHYSICAL_FREE: 'AVAILABLE_CAPACITY',

    // TODO: figure out these
    VMW_CHANGE_DAY: 'PHYSICAL_CAPACITY_DAY',
    VMW_CHANGE_WEEK: 'PHYSICAL_CAPACITY_WEEK',
    VMW_CHANGE_MONTH: 'PHYSICAL_CAPACITY_MONTH',

    // TODO:
    SLA_EVENTS_DAY: 'SLA_EVENTS',
    SLA_EVENTS_WEEK: 'SLA_EVENTS',
    SLA_EVENTS_MONTH: 'SLA_EVENTS',
    OUT_OF_SLA_TIME_DAY: 'OUT_OF_SLA_TIME',
    OUT_OF_SLA_TIME_WEEK: 'OUT_OF_SLA_TIME',
    OUT_OF_SLA_TIME_MONTH: 'OUT_OF_SLA_TIME',

    // Imbalances
    IMBALANCE_ABSOLUT: 'CHANNEL_IMBALANCES',
    IMBALANCE_ABSOLUT_WEEK: 'CHANNEL_IMBALANCES_WEEK',
    IMBALANCE_ABSOLUT_MONTH: 'CHANNEL_IMBALANCES_MONTH',

    IMBALANCE_PERC: 'CHANNEL_IMBALANCES_PERC',
    IMBALANCE_PERC_WEEK: 'CHANNEL_IMBALANCES_PERC_WEEK',
    IMBALANCE_PERC_MONTH: 'CHANNEL_IMBALANCES_PERC_MONTH',

    IMBALANCE_EVENTS: 'CHANNEL_IMBALANCES_COUNT',
    IMBALANCE_EVENTS_WEEK: 'CHANNEL_IMBALANCES_COUNT_WEEK',
    IMBALANCE_EVENTS_MONTH: 'CHANNEL_IMBALANCES_COUNT_MONTH',

    PORT_IMBALANCE_ABSOLUT: 'PORT_IMBALANCES',
    PORT_IMBALANCE_ABSOLUT_WEEK: 'PORT_IMBALANCES_WEEK',
    PORT_IMBALANCE_ABSOLUT_MONTH: 'PORT_IMBALANCES_MONTH',

    PORT_IMBALANCE_PERC: 'PORT_IMBALANCES_PERC',
    PORT_IMBALANCE_PERC_WEEK: 'PORT_IMBALANCES_PERC_WEEK',
    PORT_IMBALANCE_PERC_MONTH: 'PORT_IMBALANCES_PERC_MONTH',

    PORT_IMBALANCE_EVENTS: 'PORT_IMBALANCES_COUNT',
    PORT_IMBALANCE_EVENTS_WEEK: 'PORT_IMBALANCES_COUNT_WEEK',
    PORT_IMBALANCE_EVENTS_MONTH: 'PORT_IMBALANCES_COUNT_MONTH',
};

@Injectable()
export class MaintainerService {
    private maintainerMap: Record<string, string> = {};

    constructor(private httpService: HttpService) {
        this.maintainerMap = process.env.CONF_MAINTAINER_MAP
            ? JSON.parse(
                  readFileSync(`${process.env.CONF_MAINTAINER_MAP}`, {
                      encoding: 'utf8',
                  })
              )
            : {};
        console.log(this.maintainerMap);
    }

    public handlesSystem(id: string): boolean {
        return id in this.maintainerMap;
    }

    public async getLastMaintainerData(
        id: string,
        metric: string
    ): Promise<LastMaintainerData | undefined> {
        if (!this.handlesSystem(id)) {
            return undefined;
        }

        const maintainerUrl = this.maintainerMap[id];
        metric = metricNameMap[metric] ?? metric;

        console.log(metric);
        const lastDate: number = (
            await this.httpService
                .get(`${maintainerUrl}datasets/${metric}`)
                .toPromise()
        ).data.dataranges.reverse()[0][1];

        const variants = (
            await this.httpService
                .post(`${maintainerUrl}features/variant_recommend`, {
                    id: metric,
                    from: (lastDate - 1).toString(),
                    to: lastDate.toString(),
                })
                .toPromise()
        ).data;

        console.log(variants);

        const data = (
            await this.httpService
                .post(`${maintainerUrl}bulkload_json/${metric}`, {
                    variants: variants,
                    from: (lastDate - 1).toString(),
                    to: lastDate.toString(),
                })
                .toPromise()
        ).data;

        return {
            date: new Date(data[0][0] * 60_000),
            cols: variants.reduce((prev, next, i) => {
                prev[next] = data[0][i + 1];
                return prev;
            }, {}),
        };
    }
}

type LastMaintainerData = {
    date: Date;
    cols: Record<string, number>;
};
