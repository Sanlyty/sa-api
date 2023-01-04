import * as fs from 'fs';
import { join } from 'path';

import dayjs, { type Dayjs } from 'dayjs';
import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/config.service';

const readStamp = (dir: string) =>
    Date.UTC(
        Number(dir.slice(4, 8)),
        Number(dir.slice(8, 10)) - 1,
        Number(dir.slice(10, 12))
    );

const padStr = (n: number) => n.toString().padStart(2, '0');
const createStamp = (d: Date) =>
    `PFM_${d.getUTCFullYear()}${padStr(d.getUTCMonth() + 1)}${padStr(
        d.getUTCDate()
    )}`;

@Injectable()
export class VMwareService {
    constructor(private config: ConfigService) {}

    getLatestFile(): [string, Dayjs] | undefined {
        const root = this.config.getVmwareLocation();

        if (!root) return undefined;

        const dirs = fs
            .readdirSync(root)
            .filter(
                (dir) =>
                    dir.startsWith('PFM_') &&
                    fs.statSync(join(root, dir, 'vmware.cfg'))
            )
            .map((dir) => [dir, readStamp(dir)] as const)
            .sort(([, a], [, b]) => b - a);

        if (dirs.length === 0) return undefined;

        return [join(root, dirs[0][0], 'vmware.cfg'), dayjs(dirs[0][1])];
    }

    getUsed(date: Dayjs): Record<string, number> {
        const file = join(
            this.config.getVmwareLocation(),
            createStamp(date.toDate()),
            'vmware.cfg'
        );

        if (!fs.existsSync(file)) return {};

        const result = {};

        fs.readFileSync(file, 'utf8')
            .split('\n')
            .slice(1)
            .forEach((row) => {
                const [, storage, host, , , used] = row.trim().split(';');

                // skip incomplete lines
                if (!host) return;

                result[`${host}::${storage}`] = Number(used);
            });

        return result;
    }

    public getData() {
        const source = this.getLatestFile();

        if (!source) return undefined;

        const [file, _date] = source;

        const previous = Object.fromEntries(
            (
                [
                    ['DAY', 1],
                    ['WEEK', 7],
                    ['MONTH', 30],
                ] as const
            ).map(([k, delta]) => [
                k,
                this.getUsed(_date.subtract(delta, 'days')),
            ])
        );

        const record = {};

        fs.readFileSync(file, 'utf8')
            .split('\n')
            .slice(1)
            .forEach((row) => {
                const [, storage, host, luns, provisioned, used, usedPerc] = row
                    .trim()
                    .split(';');

                // skip incomplete lines
                if (!host) return;

                if (!(host in record)) record[host] = [];

                const date = _date.toDate();

                const diffMetrics = [];

                const key = `${host}::${storage}`;
                for (const range in previous) {
                    if (key in previous[range]) {
                        diffMetrics.push({
                            type: `USED_${range}`,
                            unit: 'GB',
                            date,
                            value: Number(used) - previous[range][key],
                        });
                        4;
                    }
                }

                record[host].push({
                    name: storage,
                    metrics: [
                        {
                            type: 'LUN_COUNT',
                            unit: '',
                            date,
                            value: Number(luns),
                        },
                        {
                            type: 'PROVISIONED',
                            unit: 'TB',
                            date,
                            value: Number(provisioned) / 1024,
                        },
                        {
                            type: 'USED',
                            unit: 'TB',
                            date,
                            value: Number(used) / 1024,
                        },
                        {
                            type: 'USED_PERC',
                            unit: '%',
                            date,
                            value: Number(usedPerc),
                        },
                        ...diffMetrics,
                    ],
                });
            });

        return Object.entries(record).map(([host, children]) => ({
            name: host,
            metrics: [],
            children,
        }));
    }
}
