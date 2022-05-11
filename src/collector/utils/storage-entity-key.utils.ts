import { StorageEntityType } from '../dto/owner.dto';
import { CollectorType } from '../factory/collector-type.enum';
import { NotFoundException } from '@nestjs/common';

export interface KeyPart {
    name: string;
    type: StorageEntityType;
}

export interface StorageEntityKey {
    datacenter: KeyPart;
    grandParent: KeyPart;
    parent: KeyPart;
    child: KeyPart;
}

export class StorageEntityKeyUtils {
    public static createComponentKey(
        systemName,
        subComponentName,
        subSubName,
        paramType: StorageEntityType
    ): StorageEntityKey {
        let componentKey: StorageEntityKey;
        if (
            subSubName !== undefined &&
            subSubName !== null &&
            paramType === StorageEntityType.PORT_GROUP
        ) {
            componentKey = {
                datacenter: {
                    name: 'CZ_Chodov',
                    type: StorageEntityType.DATACENTER,
                },
                grandParent: {
                    name: systemName,
                    type: StorageEntityType.SYSTEM,
                },
                parent: {
                    name: subComponentName,
                    type: StorageEntityType.ADAPTER_GROUP,
                },
                child: { name: subSubName, type: paramType },
            };
        } else if (
            subSubName !== undefined &&
            subSubName !== null &&
            paramType === StorageEntityType.PARITY_GROUP
        ) {
            componentKey = {
                datacenter: {
                    name: 'CZ_Chodov',
                    type: StorageEntityType.DATACENTER,
                },
                grandParent: {
                    name: systemName,
                    type: StorageEntityType.SYSTEM,
                },
                parent: {
                    name: subComponentName,
                    type: StorageEntityType.POOL,
                },
                child: { name: subSubName, type: paramType },
            };
        } else if (subComponentName !== undefined) {
            componentKey = {
                datacenter: {
                    name: 'CZ_Chodov',
                    type: StorageEntityType.DATACENTER,
                },
                grandParent: null,
                parent: { name: systemName, type: StorageEntityType.SYSTEM },
                child: { name: subComponentName, type: paramType },
            };
        } else {
            componentKey = {
                datacenter: {
                    name: 'CZ_Chodov',
                    type: StorageEntityType.DATACENTER,
                },
                grandParent: null,
                parent: null,
                child: { name: systemName, type: paramType },
            };
        }
        return componentKey;
    }

    public static of(type: CollectorType): StorageEntityType {
        switch (type) {
            case CollectorType.HOST_GROUPS:
                return StorageEntityType.HOST_GROUP;
            case CollectorType.POOLS:
                return StorageEntityType.POOL;
            case CollectorType.CHAS:
                return StorageEntityType.ADAPTER_GROUP;
            case CollectorType.SYSTEMS:
                return StorageEntityType.SYSTEM;
            case CollectorType.PORTS:
                return StorageEntityType.PORT_GROUP;
            case CollectorType.LATENCY:
                return StorageEntityType.POOL;
            case CollectorType.PARITY_GROUP:
                return StorageEntityType.PARITY_GROUP;
            // case CollectorType.CHANNEL_BOARD:
            //   return StorageEntityType.PORT;
            // case CollectorType.DKC:
            //   return StorageEntityType.DKC;
            // case CollectorType.CONTROLLER:
            //   return StorageEntityType.CONTROLLER;
            // case CollectorType.PORT:
            //   return StorageEntityType.PORT;
            default:
                throw new NotFoundException(
                    `Cannot resolve Storage entity type '${type}'`
                );
        }
    }
}
