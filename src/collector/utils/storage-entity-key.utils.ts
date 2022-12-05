import { NotFoundException } from '@nestjs/common';

import { StorageEntityType } from '../dto/owner.dto';
import { CollectorType } from '../factory/collector-type.enum';

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

const parentMap = {
    [StorageEntityType.PORT_GROUP]: StorageEntityType.ADAPTER_GROUP,
    [StorageEntityType.PARITY_GROUP]: StorageEntityType.POOL,
};

export class StorageEntityKeyUtils {
    public static createComponentKey(
        systemName,
        subComponentName,
        subSubName,
        type: StorageEntityType
    ): StorageEntityKey {
        // Default datacenter
        const datacenter = {
            name: 'CZ_Chodov',
            type: StorageEntityType.DATACENTER,
        };

        const sysKey = { name: systemName, type: StorageEntityType.SYSTEM };

        if (subSubName && type in parentMap) {
            return {
                datacenter,
                grandParent: sysKey,
                parent: {
                    name: subComponentName,
                    type: parentMap[type],
                },
                child: { name: subSubName, type },
            };
        }

        if (subComponentName) {
            return {
                datacenter,
                grandParent: null,
                parent: sysKey,
                child: { name: subComponentName, type },
            };
        }

        return {
            datacenter,
            grandParent: null,
            parent: null,
            child: { name: systemName, type },
        };
    }

    public static of(type: CollectorType): StorageEntityType {
        switch (type) {
            case 'host-groups':
                return StorageEntityType.HOST_GROUP;
            case 'pools':
            case 'latency':
                return StorageEntityType.POOL;
            case 'chas':
                return StorageEntityType.ADAPTER_GROUP;
            case 'systems':
                return StorageEntityType.SYSTEM;
            case 'ports':
                return StorageEntityType.PORT_GROUP;
            case 'parity-groups':
                return StorageEntityType.PARITY_GROUP;
            default:
                throw new NotFoundException(
                    `Cannot resolve StorageEntity type '${type}'`
                );
        }
    }
}
