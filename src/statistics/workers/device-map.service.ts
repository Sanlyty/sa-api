import { Injectable } from '@nestjs/common';

import { StorageEntityService } from '../../collector/services/storage-entity.service';
import {
    MaintainerService,
    UpdatedInfo,
} from '../../collector/services/maintainer.service';
import { StorageEntityType } from '../../collector/dto/owner.dto';
import { StorageEntityStatus } from '../../collector/enums/storage-entity-status.enum';
import prisma from '../../prisma';
import { StorageEntityEntity } from '../../collector/entities/storage-entity.entity';
import { StorageEntityKeyUtils } from '../../collector/utils/storage-entity-key.utils';
import { StorageEntityRepository } from '../../collector/repositories/storage-entity.repository';

const normalizePortName = (port: string) => {
    if (port.startsWith('CL')) {
        return port.slice(2).replace('-', '');
    } else {
        return port;
    }
};

@Injectable()
export class DeviceMapService {
    constructor(
        private maintainerService: MaintainerService,
        private storageEntityService: StorageEntityService,
        protected storageEntityRepository: StorageEntityRepository
    ) {
        this.maintainerService.loaded.then(async () => {
            await this.updateAllSystems();
            this.maintainerService.events.on('updated', (info: UpdatedInfo) => {
                if (info.type === 'hp') {
                    this.updateSystem(info.system);
                }
            });
        });
    }

    public updateAllSystems() {
        return Promise.all(
            this.maintainerService
                .getHandledSystems(['hp'])
                .map((system) => this.updateSystem(system))
        );
    }

    private async updateSystem(
        system: string,
        entity?: StorageEntityEntity
    ): Promise<void> {
        if (!(await this.maintainerService.getStatus(system))) {
            console.warn(
                `Skipping port import for ${system} as it is not available`
            );
            return;
        }

        const _systemEntity = await prisma.storageEntities.findFirst({
            where: {
                name: system,
                id_cat_storage_entity_type: StorageEntityType.SYSTEM,
            },
            select: {
                id: true,
            },
        });

        if (!_systemEntity) return;
        const systemId = _systemEntity.id;

        // Find all active pools from the maintainer
        const pools = Object.values(
            await this.maintainerService.getPoolInfo(system)
        );

        // Deactivate missing pools
        await prisma.storageEntities.updateMany({
            where: {
                parentId: systemId,
                id_cat_storage_entity_type: StorageEntityType.POOL,
                id_cat_storage_entity_status: StorageEntityStatus.ACTIVE,
                name: {
                    notIn: pools.map((pool) => pool.name),
                },
            },
            data: {
                id_cat_storage_entity_status: StorageEntityStatus.INACTIVE,
            },
        });

        // Create or reactivate pools
        for (const pool of pools) {
            const key = StorageEntityKeyUtils.createComponentKey(
                system,
                pool.name,
                null,
                StorageEntityType.POOL
            );

            const entity =
                await this.storageEntityRepository.fetchOrCreateByStorageEntityKey(
                    key
                );

            // Reactivate and update if necessary
            if (
                entity.serialNumber !== pool.id.toString() ||
                entity.idCatComponentStatus === StorageEntityStatus.INACTIVE
            ) {
                await this.storageEntityRepository.update(entity.id, {
                    serialNumber: String(pool.id),
                    idCatComponentStatus: StorageEntityStatus.ACTIVE,
                });
            }

            // Deactivate missing host groups
            await prisma.storageEntities.updateMany({
                where: {
                    parentId: pool.id,
                    id_cat_storage_entity_status: StorageEntityStatus.ACTIVE,
                    id_cat_storage_entity_type: StorageEntityType.PARITY_GROUP,
                    name: {
                        notIn: pool.eccGroups,
                    },
                },
                data: {
                    id_cat_storage_entity_status: StorageEntityStatus.INACTIVE,
                },
            });

            // Create or reactivate parity groups
            for (const pg of pool.eccGroups) {
                const pgEntity = await prisma.storageEntities.findFirst({
                    where: {
                        name: pg,
                        id_cat_storage_entity_type:
                            StorageEntityType.PARITY_GROUP,
                        storage_entities: {
                            parentId: systemId,
                        },
                    },
                    include: {
                        storage_entities: true,
                    },
                });

                if (!pgEntity) {
                    // Create of nonexistent
                    await this.storageEntityRepository.fetchOrCreateByStorageEntityKey(
                        StorageEntityKeyUtils.createComponentKey(
                            system,
                            pool.name,
                            pg,
                            StorageEntityType.PARITY_GROUP
                        )
                    );
                } else if (
                    pgEntity.storage_entities.id !== entity.id ||
                    pgEntity.id_cat_storage_entity_status ===
                        StorageEntityStatus.INACTIVE
                ) {
                    await prisma.storageEntities.update({
                        where: { id: pgEntity.id },
                        data: {
                            parentId: entity.id,
                            id_cat_storage_entity_status:
                                StorageEntityStatus.ACTIVE,
                        },
                    });
                }
            }
        }

        // Activate CHB and port pairs
        try {
            const chbInfo = await this.maintainerService.getChbInfo(system);

            // TODO: determine CTL and create a CHB
            // TODO: then create the related ports from chbInfo.chbPorts[chb]

            for (const pair of chbInfo.chbPairs) {
                const pairName = pair.join(',');

                await this.storageEntityRepository.fetchOrCreateByStorageEntityKey(
                    StorageEntityKeyUtils.createComponentKey(
                        system,
                        pairName,
                        null,
                        StorageEntityType.ADAPTER_GROUP
                    )
                );

                const leftRelatedPorts = chbInfo.chbPorts[pair[0]];
                for (const portPair of chbInfo.portPairs.filter((pair) =>
                    pair.some((port) => leftRelatedPorts.includes(port))
                )) {
                    await this.storageEntityRepository.fetchOrCreateByStorageEntityKey(
                        StorageEntityKeyUtils.createComponentKey(
                            system,
                            pairName,
                            portPair.join(','),
                            StorageEntityType.PORT_GROUP
                        )
                    );
                }
            }
        } catch (err) {
            console.error(
                `Failed to update CHB and FE port pairs for ${system}`,
                err
            );
        }

        // Find all active VMWare hostgroups from the maintainer
        const vmwHostgroups = Object.keys(
            (
                await this.maintainerService.getLastMaintainerData(
                    system,
                    'VMW_NET_TOTAL'
                )
            ).cols
        );

        // Deactivate missing
        await prisma.storageEntities.updateMany({
            where: {
                parentId: systemId,
                id_cat_storage_entity_type: StorageEntityType.HOST_GROUP,
                id_cat_storage_entity_status: StorageEntityStatus.ACTIVE,
                name: {
                    notIn: vmwHostgroups,
                },
            },
            data: {
                id_cat_storage_entity_status: StorageEntityStatus.INACTIVE,
            },
        });

        // Create or reactivate others
        for (const hostgroup of vmwHostgroups) {
            const entity =
                await this.storageEntityRepository.fetchOrCreateByStorageEntityKey(
                    StorageEntityKeyUtils.createComponentKey(
                        system,
                        hostgroup,
                        null,
                        StorageEntityType.HOST_GROUP
                    )
                );

            // reactivate if necessary
            if (entity.idCatComponentStatus === StorageEntityStatus.INACTIVE) {
                await this.storageEntityRepository.update(entity.id, {
                    idCatComponentStatus: StorageEntityStatus.ACTIVE,
                });
            }
        }

        // FIXME: query only the specific system
        const systemEntity =
            entity ??
            (
                await this.storageEntityService.getAllSystems(
                    StorageEntityType.PORT,
                    undefined,
                    [StorageEntityStatus.ACTIVE]
                )
            )
                .flatMap((dc) => dc.children)
                .find((e) => e.name === system);

        if (!systemEntity) return;

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
                        (prev, row) => prev + row[i + 1] / data.data.length,
                        0
                    ) / 1000,
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
                          slot: fePorts[port].slot_port,
                          wwn: fePorts[port].wwn,
                          san_env: fePorts[port].san_env,
                      }
                    : {};

            try {
                await prisma.storageEntityDetails.update({
                    where: { id_storage_entity: portMap[port] },
                    data: {
                        ...portInfo,
                        throughput: Math.round(avg),
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
