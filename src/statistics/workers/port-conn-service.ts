import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageEntityService } from '../../collector/services/storage-entity.service';
import { MaintainerService } from '../../collector/services/maintainer.service';
import { StorageEntityType } from '../../collector/dto/owner.dto';
import { StorageEntityStatus } from '../../collector/enums/storage-entity-status.enum';
import prisma from '../../prisma';

const normalizePortName = (port: string) => {
    if (port.startsWith('CL')) {
        return port.slice(2).replace('-', '');
    } else {
        return port;
    }
};

@Injectable()
export class PortConnectivityService {
    constructor(
        private maintainerService: MaintainerService,
        private storageEntityService: StorageEntityService
    ) {
        this.getThroughput();
    }

    @Cron('0 0 */6 * * *')
    public async getThroughput() {
        const entities = (
            await this.storageEntityService.getAllSystems(
                StorageEntityType.PORT,
                undefined,
                [StorageEntityStatus.ACTIVE]
            )
        ).flatMap((dc) => dc.children);

        for (const system of this.maintainerService.getHandledSystems()) {
            if (!(await this.maintainerService.getStatus(system))) {
                console.warn(
                    `Skipping port import for ${system} as it is not available`
                );
                continue;
            }

            const systemEntity = entities.find((e) => e.name === system);

            if (!systemEntity) continue;

            const fePorts = await this.maintainerService.getFePorts(system);
            const data = await this.maintainerService.getMaintainerData(
                system,
                'Port_KBPS',
                7 * 24 * 60
            );
            const ports = data.variants.map(
                (p, i) =>
                    [
                        normalizePortName(p),
                        data.data.reduce(
                            (prev, row) => prev + row[i] / data.data.length,
                            0
                        ) / 1024,
                    ] as [string, number]
            );

            const portMap: { [name: string]: number } = Object.fromEntries(
                systemEntity.children.flatMap((dkc) =>
                    dkc.children.flatMap((ctl) =>
                        ctl.children.flatMap((cha) =>
                            cha.children.map((port) => [port.name, port.id])
                        )
                    )
                )
            );

            for (const [port, avg] of ports) {
                if (!(port in portMap)) continue;
                const portInfo =
                    port in fePorts
                        ? {
                              covers: fePorts[port].covers.join(','),
                              cables: fePorts[port].cables,
                              automation: fePorts[port].automation,
                              speed: fePorts[port].speed,
                              switch: fePorts[port].switch,
                              note: fePorts[port].description,
                          }
                        : {};

                try {
                    await prisma.storageEntityDetails.update({
                        where: { id_storage_entity: portMap[port] },
                        data: {
                            ...portInfo,
                            throughput: Math.trunc(avg),
                        },
                    });
                } catch (err) {
                    console.error(
                        `Failed to update port data for ${port} @ ${system}, missing StorageEntityDetails`
                    );
                }
            }
        }
    }
}
