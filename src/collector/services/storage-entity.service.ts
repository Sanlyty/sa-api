import { Injectable } from '@nestjs/common';
import { StorageEntityRequestDto } from '../dto/storage-entity-request.dto';
import { StorageEntityType } from '../dto/owner.dto';
import { ArgumentError } from './errors/argument.error';
import { ErrorCodeConst } from '../../errors/error-code.enum';
import { StorageEntityAlreadyExistsError } from './errors/storage-entity-already-exists.error';
import { StorageEntityRepository } from '../repositories/storage-entity.repository';
import { StorageEntityEntity } from '../entities/storage-entity.entity';
import { StorageEntityStatus } from '../enums/storage-entity-status.enum';
import { ChangeStatusRequestDto } from '../dto/change-status-request.dto';
import { StorageEntityKey } from '../utils/storage-entity-key.utils';
import { SystemDetailsService } from './system-details.service';
import { StorageEntityDetailRequestDto } from '../dto/storage-entity-detail-request.dto';
import { StorageEntityNotFoundError } from './errors/storage-entity-not-found.error';
import { DbEvalUtils } from '../utils/db-eval.utils';
import { isNotEmpty } from 'class-validator';
import { DuplicateStorageEntityDto } from '../dto/duplicate-storage-entity.dto';

@Injectable()
export class StorageEntityService {
    private static CHECK_DUPLICITY_TYPE = [
        StorageEntityType.DATACENTER,
        StorageEntityType.SYSTEM,
        StorageEntityType.POOL,
        // StorageEntityType.PORT,
        // StorageEntityType.CHANNEL_BOARD,
        // StorageEntityType.DKC,
        // StorageEntityType.CONTROLLER,
    ];

    constructor(
        private storageEntityRepository: StorageEntityRepository,
        private systemDetailsService: SystemDetailsService
    ) {}

    async create(
        requestEntity: StorageEntityRequestDto
    ): Promise<StorageEntityEntity> {
        let parent;
        if (requestEntity.type !== StorageEntityType.DATACENTER) {
            parent = await this.storageEntityRepository.findOne(
                requestEntity.parentId
            );
            if (parent === undefined) {
                throw new ArgumentError(
                    ErrorCodeConst.ENTITY_NOT_FOUND,
                    `Database entity with id '${requestEntity.parentId}' was not found`
                );
            }

            if (await this.isAlreadyExists(requestEntity, parent)) {
                throw new StorageEntityAlreadyExistsError(
                    `Storage Entity '${
                        StorageEntityType[requestEntity.type]
                    }' ` + `with name '${requestEntity.name}' already exists.`
                );
            }
        } else {
            parent = null;
        }

        const entity = this.createEntity(requestEntity, parent);

        return await this.storageEntityRepository.save(entity);
    }

    private async isAlreadyExists(
        requestEntity: StorageEntityRequestDto,
        parentEntity
    ) {
        const entities = await this.storageEntityRepository.find({
            where: { name: requestEntity.name },
            join: {
                alias: 'storageEntity',
                leftJoinAndSelect: { parent: 'storageEntity.parent' },
            },
        });
        if (
            StorageEntityService.CHECK_DUPLICITY_TYPE.includes(
                requestEntity.type
            )
        ) {
            return entities.some(
                (entity) =>
                    entity !== undefined && entity.idType === requestEntity.type
            );
        }
        return entities.some(
            (entity) =>
                entity !== undefined &&
                entity.parentId === parentEntity.id &&
                entity.idType === requestEntity.type
        );
    }

    private createEntity(
        requestEntity: StorageEntityRequestDto,
        parent: StorageEntityEntity
    ) {
        const entity = this.storageEntityRepository.create();
        entity.name = requestEntity.name;
        entity.parent = parent;
        entity.idType = requestEntity.type;
        entity.idCatComponentStatus = StorageEntityStatus.ACTIVE;
        entity.serialNumber = requestEntity.serialNumber;

        return entity;
    }

    public availableSystems() {
        return this.storageEntityRepository.availableSystems();
    }

    public getAllSystems(
        type: StorageEntityType,
        systemId: number = null,
        status: StorageEntityStatus[] = [StorageEntityStatus.ACTIVE]
    ) {
        return this.storageEntityRepository.getStorageEntities(
            type,
            systemId,
            status
        );
    }

    public async updateStatus(
        key: StorageEntityKey,
        requestDto: ChangeStatusRequestDto
    ): Promise<StorageEntityEntity> {
        const storageEntity =
            await this.storageEntityRepository.fetchByStorageEntityKey(key);
        const storageEntityTree =
            await this.storageEntityRepository.findDescendantsTree(
                storageEntity
            );
        return this.updateStatusRecursively(storageEntityTree, requestDto);
    }

    public async updateStatusById(
        id: number,
        requestDto: ChangeStatusRequestDto
    ): Promise<StorageEntityEntity> {
        const storageEntity = await this.storageEntityRepository.findOne(id);
        const storageEntityTree =
            await this.storageEntityRepository.findDescendantsTree(
                storageEntity
            );
        return this.updateStatusRecursively(storageEntityTree, requestDto);
    }

    public async updateStatusRecursively(
        storageEntity: StorageEntityEntity,
        requestDto: ChangeStatusRequestDto
    ): Promise<StorageEntityEntity> {
        if (storageEntity.children.length > 0) {
            storageEntity.children = await Promise.all(
                storageEntity.children.map(
                    async (child) =>
                        await this.updateStatusRecursively(child, requestDto)
                )
            );
        }
        storageEntity.idCatComponentStatus = requestDto.status;
        await this.storageEntityRepository.update(storageEntity.id, {
            idCatComponentStatus: requestDto.status,
        });
        return storageEntity;
    }

    async update(id: number, request: StorageEntityDetailRequestDto) {
        const entity = await this.storageEntityRepository.findOne(id);

        if (entity === undefined) {
            throw new ArgumentError(
                ErrorCodeConst.ENTITY_NOT_FOUND,
                `Database entity with id '${id}' was not found`
            );
        }

        entity.name = DbEvalUtils.coalesce(request.name, entity.name);
        entity.serialNumber = DbEvalUtils.coalesce(
            request.serialNumber,
            entity.serialNumber
        );
        entity.detail = await this.systemDetailsService.upsert(id, request);
        return await this.storageEntityRepository.save(entity);
    }

    async delete(id: number) {
        const entity = await this.storageEntityRepository.findOne(id, {
            relations: ['children'],
        });
        if (entity === undefined) {
            throw new StorageEntityNotFoundError(`Entity(id: ${id}) not found`);
        }
        if (isNotEmpty(entity.children)) {
            for (const child of entity.children) {
                await this.delete(child.id);
            }
        }
        await this.deleteData(entity);
        await this.storageEntityRepository.query(
            'DELETE FROM storage_entities_closure ' +
                'WHERE id_descendant IN (SELECT id_descendant ' +
                '                     FROM storage_entities_closure ' +
                '                     WHERE id_ancestor = ' +
                id +
                ');'
        );
        await this.storageEntityRepository
            .createQueryBuilder()
            .delete()
            .from(StorageEntityEntity)
            .where('id = :id', { id: entity.id })
            .execute();
    }

    async move(id: number, parentId: number) {
        const entity = await this.storageEntityRepository.findOne(id);
        if (
            entity === undefined ||
            entity.idCatComponentStatus === StorageEntityStatus.INACTIVE
        ) {
            throw new StorageEntityNotFoundError(
                `Entity(id: ${id}) not found or is INACTIVE.`
            );
        }
        const parentEntity = await this.storageEntityRepository.findOne(
            parentId
        );
        if (
            parentEntity === undefined ||
            parentEntity.idCatComponentStatus === StorageEntityStatus.INACTIVE
        ) {
            throw new StorageEntityNotFoundError(
                `Entity(id: ${parentId}) not found or is INACTIVE.`
            );
        }
        this.storageEntityRepository.query(`
      DELETE FROM storage_entities_closure
      WHERE id_descendant IN (SELECT id_descendant
                     FROM storage_entities_closure
                     WHERE id_ancestor = ${id})
      AND id_ancestor IN (SELECT id_ancestor
                     FROM storage_entities_closure
                     WHERE id_descendant = ${id}
                     AND id_ancestor != id_descendant);
    `);

        this.storageEntityRepository.query(`
INSERT INTO storage_entities_closure (id_ancestor, id_descendant)
SELECT supertree.id_ancestor, subtree.id_descendant
FROM storage_entities_closure AS supertree
CROSS JOIN storage_entities_closure AS subtree
WHERE supertree.id_descendant = ${parentId}
AND subtree.id_ancestor = ${id};
    `);
        entity.parent = parentEntity;
        await this.storageEntityRepository.save(entity);
    }

    async duplicate(
        requestDto: DuplicateStorageEntityDto,
        sourceStorageEntityId: number
    ) {
        const system = await this.storageEntityRepository.findOne(
            sourceStorageEntityId,
            { relations: ['children'] }
        );
        if (system === undefined) {
            throw new StorageEntityNotFoundError(
                `Entity(id: ${sourceStorageEntityId}) not found.`
            );
        }
        const request = new StorageEntityRequestDto();
        request.type = system.idType;
        request.name = requestDto.name;
        request.serialNumber = requestDto.serialNumber;
        request.parentId = system.parentId;
        const duplicatedSystem = await this.create(request);

        const detail = new StorageEntityDetailRequestDto();
        detail.prefixReferenceId = requestDto.prefixReferenceId;
        this.systemDetailsService.upsert(duplicatedSystem.id, detail);

        if (system.children !== undefined && isNotEmpty(system.children)) {
            await this.duplicateChildren(
                system.children,
                duplicatedSystem,
                requestDto.types
            );
        }

        return duplicatedSystem;
    }

    async duplicateChildren(
        children: StorageEntityEntity[],
        parent: StorageEntityEntity,
        typesToBeDuplicated: StorageEntityType[]
    ) {
        for (const child of this.filterOutByType(
            typesToBeDuplicated,
            children
        )) {
            const childRequest = new StorageEntityRequestDto();
            childRequest.type = child.idType;
            childRequest.name = child.name;
            childRequest.parentId = parent.id;
            const duplicatedChild = await this.create(childRequest);
            const childrenLoaded = (
                await this.storageEntityRepository.findOne(child.id, {
                    relations: ['children'],
                })
            ).children;
            if (childrenLoaded !== undefined && isNotEmpty(childrenLoaded)) {
                await this.duplicateChildren(
                    childrenLoaded,
                    duplicatedChild,
                    typesToBeDuplicated
                );
            }
        }
    }

    filterOutByType(types: StorageEntityType[], storageEntities) {
        return storageEntities.filter((storageEntity) =>
            types.includes(storageEntity.idType)
        );
    }

    private async deleteData(entity: StorageEntityEntity) {
        await this.storageEntityRepository.query(`
      DELETE FROM block_size_latency
      WHERE id_storage_entity=${entity.id}
    `);

        await this.storageEntityRepository.query(`
      DELETE FROM externals
      WHERE id_storage_entity=${entity.id}
    `);
        await this.storageEntityRepository.query(`
      DELETE FROM host_group_metrics
      WHERE id_storage_entity=${entity.id}
    `);
        await this.storageEntityRepository.query(`
      DELETE FROM parity_group_metrics
      WHERE id_storage_entity=${entity.id}
    `);
        await this.storageEntityRepository.query(`
      DELETE FROM cha_metrics
      WHERE id_storage_entity=${entity.id}
    `);
        await this.storageEntityRepository.query(`
      DELETE FROM pool_metrics
      WHERE id_storage_entity=${entity.id}
    `);
        await this.storageEntityRepository.query(`
      DELETE FROM port_metrics
      WHERE id_storage_entity=${entity.id}
    `);
        await this.storageEntityRepository.query(`
      DELETE FROM system_metrics
      WHERE id_storage_entity=${entity.id}
    `);

        await this.storageEntityRepository.query(`
      DELETE FROM storage_entity_details
      WHERE id_storage_entity=${entity.id}
    `);
    }
}
