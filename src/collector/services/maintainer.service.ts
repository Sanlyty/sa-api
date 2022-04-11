import { Injectable, HttpService } from '@nestjs/common';

@Injectable()
export class MaintainerService {
    private maintainerMap = {
        XP8_G22_30738: 'http://127.0.0.1:8420/',
    };

    constructor(private httpService: HttpService) {}

    public handlesSystem(id: string): boolean {
        return id in this.maintainerMap;
    }

    public async getLastMaintainerData(
        id: string,
        metric: string
    ): Promise<LastMaintainerData | undefined> {
        const maintainerUrl = this.maintainerMap[id];

        if (!maintainerUrl) {
            return undefined;
        }

        if (metric.startsWith('RESPONSE_')) {
            const [, dur] = metric.split('_');
            metric = `RESPONSE_READ_${dur}`;
        } else if (metric === 'RESPONSE') {
            metric = 'RESPONSE_READ_DAY';
        }

        console.log(metric);
        const lastDate: number = (
            await this.httpService
                .get(`${maintainerUrl}datasets/${metric}`)
                .toPromise()
        ).data.dataranges.reverse()[0][1];

        const variants: string[] = ['peak', 'average']; // TODO:
        const data = (
            await this.httpService
                .post(`${maintainerUrl}bulkload_json/${metric}`, {
                    variants: variants,
                    from: (lastDate - 1).toString(),
                    to: lastDate.toString(),
                })
                .toPromise()
        ).data;

        console.log(data);
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
