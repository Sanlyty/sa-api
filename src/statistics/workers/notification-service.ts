import { readFileSync, writeFile, existsSync, unlink } from 'fs';

import { Injectable } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

import { ConfigService } from '../../config/config.service';
import {
    MaintainerService,
    UpdatedInfo,
} from '../../collector/services/maintainer.service';
import { StorageEntityRepository } from '../../collector/repositories/storage-entity.repository';
import { StorageEntityType } from '../../collector/dto/owner.dto';
import { StorageEntityStatus } from '../../collector/enums/storage-entity-status.enum';

// TODO: choose a better persistance method
@Injectable()
export class NotificationService {
    private mailer: Transporter | undefined;
    private lastChecked: { [system: string]: number } = {};

    constructor(
        private config: ConfigService,
        private maintainerService: MaintainerService,
        private entityRepo: StorageEntityRepository
    ) {
        if (existsSync('last_notify')) {
            try {
                const loaded = JSON.parse(
                    readFileSync('last_notify').toString()
                );

                if (typeof loaded === 'object') {
                    this.lastChecked = loaded;
                }
            } catch (err) {
                unlink('last_notify', () => {
                    // nothing
                });
                console.error(`Failed to recover 'last_notify':`, err);
            }
        }

        if (this.trySetMailer() && this.config.getSmtpMaintenanceTo()?.length) {
            this.mailer
                .sendMail({
                    from: this.config.getSmtpFrom(),
                    to: this.config.getSmtpMaintenanceTo(),
                    subject: `Graphium Dashboard Notification`,
                    html: `The notification service has been started`,
                })
                .catch(console.error);
        }

        this.maintainerService.loaded.then(async () => {
            await this.parityGroupAlert().catch(console.error);

            this.maintainerService.events.on('updated', (data: UpdatedInfo) => {
                if (data.type === 'hp') {
                    this.debouncedInvoke();
                }
            });
        });
    }

    private debounceTimer: NodeJS.Timeout;
    private debouncedInvoke = () => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.parityGroupAlert().catch(console.error);
        }, 30_000);
    };

    private trySetMailer = () => {
        if (this.mailer) return true;

        const settings = this.config.getSmtpSettings();

        if (settings) {
            this.mailer = createTransport(settings);
            return true;
        }

        return false;
    };

    private getPoolMap = async (): Promise<Record<string, string>> => {
        const systems = (
            await this.entityRepo
                .querySystems()
                .innerJoinAndSelect(
                    'system.children',
                    'pool',
                    'pool.idType = :poolType',
                    { poolType: StorageEntityType.POOL }
                )
                .leftJoinAndSelect(
                    'pool.children',
                    'parityGroup',
                    'parityGroup.idType=:parityGroupType',
                    { parityGroupType: StorageEntityType.PARITY_GROUP }
                )
                .where('parityGroup.idCatComponentStatus = :idStatus', {
                    idStatus: StorageEntityStatus.ACTIVE,
                })
                .getMany()
        ).flatMap((d) => d.children);

        const poolMap = {};

        for (const system of systems) {
            for (const pool of system.children) {
                for (const parityGroup of pool.children) {
                    const id = `${system.name}:${parityGroup.name}`;

                    poolMap[id] = pool.name;
                }
            }
        }

        return poolMap;
    };

    public async parityGroupAlert() {
        if (!this.trySetMailer()) return;

        const reported: {
            system: string;
            pg: string;
            pool: string;
            average: number;
            peak: number;
            len: number;
            from: Date;
            to: Date;
        }[] = [];

        const poolMap = await this.getPoolMap();
        const now = new Date().getTime();

        for (const system of this.maintainerService.getHandledSystems(['hp'])) {
            if (!(await this.maintainerService.getStatus(system))) {
                console.warn(
                    `Skipping PG notifications for ${system} as it is not available`
                );
                continue;
            }

            const { up_to, events } = await this.maintainerService.getPGEvents(
                system,
                // Last two days
                Math.max(now - 2 * 86_400_000, this.lastChecked[system] ?? 0),
                now
            );

            this.lastChecked[system] = up_to;

            events.forEach((e) => {
                const pool = poolMap[`${system}:${e.key}`];

                if (!pool) return;

                reported.push({
                    system,
                    from: new Date(e.from),
                    to: new Date(e.to),
                    len: (e.to - e.from) / 60_000,
                    average: e.average,
                    peak: e.peak,
                    pg: `PG ${e.key}`,
                    pool,
                });
            });
        }

        if (reported.length > 0) {
            // Fancy email version
            const systemMap: Record<string, typeof reported> = {};
            reported.forEach((r) => {
                if (!(r.system in systemMap)) {
                    systemMap[r.system] = [];
                }

                systemMap[r.system].push(r);
            });

            const systems = Object.keys(systemMap);
            const subject = `Graphium Dashboard Warning - ${
                systems.length === 1 ? systems[0] : 'multiple systems'
            } - Parity Group Utilization Alert`;
            let html =
                '<style>td,th{border:1px solid black;padding:4px;}</style>';

            for (const system in systemMap) {
                html += `<h1>${system}</h1>`;
                html +=
                    '<table style="border:1px solid black;border-collapse:collapse;margin-bottom:1em;">';
                html += `<tr><th>Parity Group</th><th>Pool Name</th><th>Utilization/Peak</th><th>From</th><th>To</th><th>Duration [min]</th></tr>`;
                for (const row of systemMap[system]) {
                    html += `<tr><td>${row.pg}</td><td>${
                        row.pool
                    }</td><td style="text-align:center">${row.average.toFixed(
                        1
                    )}%/${row.peak.toFixed(
                        1
                    )}%</td><td>${row.from.toUTCString()}</td><td>${row.to.toUTCString()}</td><td style="text-align:center">${
                        row.len
                    }</td></tr>`;
                }
                html += '</table>';

                const url = new URL(
                    `/overview/${system}/dpSla`,
                    this.config.getPublicUrl()
                );
                html += `<a href="${url.href}">For more details view in Graphium Dashboard</a>`;
            }

            try {
                await this.mailer.sendMail({
                    from: this.config.getSmtpFrom(),
                    to: this.config.getSmtpTo(),
                    subject,
                    html,
                });
            } catch (e) {
                console.error(e);
                return;
            }

            // Plain version
            const plain = this.config.getSmtpPlainTo();

            if (plain) {
                try {
                    await this.mailer.sendMail({
                        from: this.config.getSmtpFrom(),
                        to: plain,
                        subject,
                        text: reported
                            .map(
                                (r) =>
                                    `System=${r.system}, PG=${
                                        r.pg
                                    }, Pool Name=${
                                        r.pool
                                    }, Utilization=${r.average.toFixed(
                                        1
                                    )}, Date=${r.from.toDateString()}, Duration=${
                                        r.len
                                    }`
                            )
                            .join('\r\n')
                            .trimEnd(),
                    });
                } catch (e) {
                    console.error(e);
                    return;
                }
            }
        }

        writeFile(
            'last_notify',
            JSON.stringify(this.lastChecked),
            (e) => e && console.error(e)
        );
    }
}
