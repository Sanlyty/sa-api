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
    private mailer: Transporter;
    private lastChecked: number;

    constructor(
        private config: ConfigService,
        private maintainerService: MaintainerService,
        private entityRepo: StorageEntityRepository
    ) {
        this.mailer = createTransport({
            ...config.getSmtpSettings(),
        });

        if (existsSync('last_notify'))
            this.lastChecked = Number(readFileSync('last_notify'));
    }

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

    @Cron('0 0 */2 * * *')
    public async parityGroupAlert() {
        const reported: {
            system: string;
            pg: string;
            pool: string;
            perc: number;
            len: number;
            when: Date;
        }[] = [];

        const poolMap = await this.getPoolMap();
        const now = new Date().getTime();

        for (const system of this.maintainerService.getHandledSystems()) {
            const events = await this.maintainerService.getPGEvents(
                system,
                Math.max(now - 200 * 32 * 60 * 60_000, this.lastChecked),
                now
            );

            events.forEach((e) => {
                reported.push({
                    system,
                    len: (e.to - e.from) / 60_000,
                    when: new Date((e.to + e.from) / 2),
                    perc: e.average,
                    pg: `PG ${e.key}`,
                    pool: poolMap[`${system}:${e.key}`] ?? '?',
                });
            });
        }

        if (reported.length > 0) {
            const systems: Set<string> = new Set(reported.map((r) => r.system));

            const systemsText =
                systems.size === 1
                    ? systems.values().next().value
                    : 'multiple systems';

            await this.mailer.sendMail({
                from: this.config.getSmtpFrom(),
                to: this.config.getSmtpTo(),
                subject: `Storage Analytics Warning - ${systemsText} - Parity Group Utilization Alert`,
                html: `<ul>${reported
                    .map(
                        (e) =>
                            `<li>${e.system} ==> <b>${e.perc.toFixed(
                                1
                            )}[%]</b> util of ${e.pg} ==> <b>${
                                e.len
                            } minutes</b> over threshold (${e.when.toString()}). Affected StoragePool: <b>${
                                e.pool
                            }</b></li>`
                    )
                    .join()}</ul>`,
            });
        }

        this.lastChecked = now;
        writeFile(
            'last_notify',
            JSON.stringify(now),
            (e) => e && console.error(e)
        );
    }
}
