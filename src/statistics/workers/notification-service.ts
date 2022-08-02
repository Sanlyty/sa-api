import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { readFileSync, writeFile, existsSync } from 'fs';
import { createTransport, Transporter } from 'nodemailer';
import { ConfigService } from '../../config/config.service';
import { MaintainerService } from '../../collector/services/maintainer.service';
import { StorageEntityRepository } from '../../collector/repositories/storage-entity.repository';
import { StorageEntityType } from '../../collector/dto/owner.dto';
import { StorageEntityStatus } from '../../collector/enums/storage-entity-status.enum';

// TODO: choose a better persistance method
@Injectable()
export class NotificationService {
    private mailer: Transporter | undefined;
    private lastChecked: number;

    constructor(
        private config: ConfigService,
        private maintainerService: MaintainerService,
        private entityRepo: StorageEntityRepository
    ) {
        if (existsSync('last_notify'))
            this.lastChecked = Number(readFileSync('last_notify'));

        if (this.trySetMailer()) {
            this.mailer
                .sendMail({
                    from: this.config.getSmtpFrom(),
                    to: this.config.getSmtpTo(),
                    subject: `Storage Analytics Notification`,
                    html: `The notification service has been started`,
                })
                .catch(console.error);

            this.parityGroupAlert().catch(console.error);
        }
    }

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

    @Cron('0 */10 * * * *')
    public async parityGroupAlert() {
        if (!this.trySetMailer()) return;

        const reported: {
            system: string;
            pg: string;
            pool: string;
            average: number;
            peak: number;
            len: number;
            when: Date;
        }[] = [];

        const poolMap = await this.getPoolMap();
        const now = new Date().getTime();

        for (const system of this.maintainerService.getHandledSystems()) {
            const events = await this.maintainerService.getPGEvents(
                system,
                // Last two days
                Math.max(now - 2 * 86_400_000, this.lastChecked),
                now
            );

            events.forEach((e) => {
                const pool = poolMap[`${system}:${e.key}`];

                if (!pool) return;

                reported.push({
                    system,
                    len: (e.to - e.from) / 60_000,
                    when: new Date((e.to + e.from) / 2),
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
            const subject = `Storage Analytics Warning - ${
                systems.length === 1 ? systems[0] : 'multiple systems'
            } - Parity Group Utilization Alert`;
            let html = '';

            for (const system in systemMap) {
                html += `<h1>${system}</h1>`;
                html += '<table>';
                html += `<tr><th>Parity Group</th><th>Pool Name</th><th>Utilization/Peak [%]</th><th>Date</th><th>Duration [min]</th></tr>`;
                for (const row of systemMap[system]) {
                    html += `<tr><td>${row.pg}</td><td>${
                        row.pool
                    }</td><td style="text-align:center">${row.average.toFixed(
                        1
                    )}/${row.peak.toFixed(
                        1
                    )}</td><td>${row.when.toDateString()}</td><td style="text-align:center">${
                        row.len
                    }</td></tr>`;
                }
                html += '</table>';
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
                                    )}, Date=${r.when.toDateString()}, Duration=${
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

        this.lastChecked = now;
        writeFile(
            'last_notify',
            JSON.stringify(now),
            (e) => e && console.error(e)
        );
    }
}
