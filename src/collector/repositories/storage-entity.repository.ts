import { EntityRepository, SelectQueryBuilder, TreeRepository } from 'typeorm';
import { StorageEntityEntity } from '../entities/storage-entity.entity';
import { StorageEntityStatus } from '../enums/storage-entity-status.enum';
import { StorageEntityType } from '../dto/owner.dto';
import { isEmpty } from '@nestjs/common/utils/shared.utils';
import { LatencyEntity } from '../entities/latency.entity';
import { StorageEntityNotFoundError } from '../services/errors/storage-entity-not-found.error';
import { KeyPart, StorageEntityKey } from '../utils/storage-entity-key.utils';

@EntityRepository(StorageEntityEntity)
export class StorageEntityRepository extends TreeRepository<StorageEntityEntity> {
  private hierachyType: ((query: SelectQueryBuilder<StorageEntityEntity>, type: StorageEntityType, systemId: number, status: StorageEntityStatus[]) => void)[][] = [];

  constructor() {
    super();
    this.hierachyType[StorageEntityType.DATACENTER] = [(query) => query];
    this.hierachyType[StorageEntityType.SYSTEM] = [this.getAllSystems];

    this.hierachyType[StorageEntityType.DKC] = [this.getAllSystems, this.getAllDkcs];
    this.hierachyType[StorageEntityType.CONTROLLER] = [this.getAllSystems, this.getAllDkcs, this.getAllControllers];
    this.hierachyType[StorageEntityType.CHANNEL_BOARD] = [this.getAllSystems, this.getAllDkcs, this.getAllControllers, this.getAllChannelBoards];
    this.hierachyType[StorageEntityType.PORT] = [
      this.getAllSystems,
      this.getAllDkcs,
      this.getAllControllers,
      this.getAllChannelBoards,
      this.getAllPorts,
    ];

  }

  public async fetchByStorageEntityKey(key: StorageEntityKey): Promise<StorageEntityEntity> {
    const keyParts = StorageEntityRepository.getKeyParts(key);
    // TODO never looking for different dataCenter
    const dataCenterEntity = await this.findOneByName(key.datacenter.name, key.datacenter.type);

    return await this.findOrCreate(keyParts, dataCenterEntity, false);
  }

  public async fetchOrCreateByStorageEntityKey(key: StorageEntityKey): Promise<StorageEntityEntity> {
    const keyParts = StorageEntityRepository.getKeyParts(key);
    const dataCenterEntity = await this.findOneByName(key.datacenter.name, key.datacenter.type);

    return await this.findOrCreate(keyParts, dataCenterEntity, true);
  }

  private async findOrCreate(keyParts: KeyPart[], parentEntity: StorageEntityEntity, createIfNotExists = false): Promise<StorageEntityEntity> {
    const searchKey = keyParts.pop();
    const parentToSearch = parentEntity.idType === StorageEntityType.DATACENTER ? null : parentEntity;
    let storageEntity = await this.findOneByName(searchKey.name, searchKey.type, parentToSearch);
    if (storageEntity === undefined && createIfNotExists === true) {
      storageEntity = this.create(
        { name: searchKey.name, idType: searchKey.type, idCatComponentStatus: StorageEntityStatus.ACTIVE, parent: parentEntity },
      );
      await this.save(storageEntity);
    } else if (storageEntity === undefined && createIfNotExists === false) {
      throw new StorageEntityNotFoundError(`Cannot find storage entity ${StorageEntityType[searchKey.type]} with name ${searchKey.name}`);
    }
    if (!isEmpty(keyParts)) {
      return this.findOrCreate(keyParts, storageEntity, createIfNotExists);
    }
    storageEntity.parent = parentEntity;
    return storageEntity;
  }

  private async findOneByName(entityName: string, type: StorageEntityType, paramParent: StorageEntityEntity = null): Promise<StorageEntityEntity> {
    const query = this.createQueryBuilder('storageEntity')
      .leftJoinAndSelect('storageEntity.parent', 'parent')
      .leftJoinAndSelect('storageEntity.externals', 'externals')
      .where('storageEntity.name = :name', { name: entityName })
      .andWhere('storageEntity.idType = :type', { type });
    if (paramParent !== null) {
      query.andWhere('storageEntity.parent = :parent', { parent: paramParent.id });
    }
    return await query.getOne();
  }

  private static getKeyParts(key: StorageEntityKey): KeyPart[] {
    return [key.child, key.parent, key.grandParent].filter(value => value !== null);
  }

  public async findDataCenters(): Promise<StorageEntityEntity[]> {
    return await this.createQueryBuilder('datacenter')
      .innerJoinAndSelect('datacenter.children', 'system')
      .innerJoinAndSelect('system.detail', 'detail')
      .andWhere('datacenter.idType = :idType', { idType: StorageEntityType.DATACENTER })
      .andWhere('system.idCatComponentStatus = :status', { status: StorageEntityStatus.ACTIVE })
      .getMany();
  }

  public async availableSystems(): Promise<StorageEntityEntity[]> {
    return await this.createQueryBuilder('storageEntity')
      .innerJoinAndSelect('storageEntity.children', 'pools')
      .innerJoin(LatencyEntity, 'metric', 'pools.id = metric.owner')
      .andWhere('storageEntity.idType = :type', { type: StorageEntityType.SYSTEM })
      .andWhere('storageEntity.idCatComponentStatus = :status', { status: StorageEntityStatus.ACTIVE })
      .getMany();
  }

  public async getStorageEntities(type: StorageEntityType, systemId: number, status: StorageEntityStatus[]): Promise<StorageEntityEntity[]> {
    const query = this.createQueryBuilder('datacenter')
      .andWhere('datacenter.idType = :dcType', { dcType: StorageEntityType.DATACENTER })
      .andWhere('datacenter.idCatComponentStatus = :dcStatus', { dcStatus: StorageEntityStatus.ACTIVE });
    this.hierachyType[type].forEach(decorate => {
      decorate(query, type, systemId, status);
    });
    return await query.getMany();
  }

  private getAllSystems(query: SelectQueryBuilder<StorageEntityEntity>, type: StorageEntityType, systemId: number, status: StorageEntityStatus[]): void {
    query.leftJoinAndSelect('datacenter.children', 'system', 'system.idType = :systemType', { systemType: StorageEntityType.SYSTEM })
      .leftJoinAndSelect('system.detail', 'detail');
    if (type === StorageEntityType.SYSTEM) {
      query.andWhere('COALESCE(system.idCatComponentStatus, CAST(1 as smallint)) IN (:...systemStatus)', { systemStatus: status });
    }
    if (systemId !== null) {
      query.andWhere('system.id = :id', { id: systemId });
    }
  }

  private getAllDkcs(query: SelectQueryBuilder<StorageEntityEntity>, type: StorageEntityType, systemId: number, status: StorageEntityStatus[]): void {
    query.leftJoinAndSelect('system.children', 'dkc', 'dkc.idType = :dkcType', { dkcType: StorageEntityType.DKC })
      .leftJoinAndSelect('dkc.detail', 'dkcDetail');
    if (type === StorageEntityType.DKC) {
      query.andWhere('dkc.idCatComponentStatus IN (:...dkcStatus)', { dkcStatus: status });
    }
  }

  public getAllControllers(query: SelectQueryBuilder<StorageEntityEntity>, type: StorageEntityType, systemId: number, status: StorageEntityStatus[]): void {
    query.leftJoinAndSelect('dkc.children', 'controller', 'controller.idType = :controllerType', { controllerType: StorageEntityType.CONTROLLER })
      .leftJoinAndSelect('controller.detail', 'controllerDetail');
    if (type === StorageEntityType.CONTROLLER) {
      query.andWhere('controller.idCatComponentStatus IN (:...controllerStatus)', { controllerStatus: status });
    }
  }

  public getAllChannelBoards(query: SelectQueryBuilder<StorageEntityEntity>, type: StorageEntityType, systemId: number, status: StorageEntityStatus[]): void {
    query.leftJoinAndSelect('controller.children', 'channelBoard', 'channelBoard.idType = :channelBoardType', { channelBoardType: StorageEntityType.CHANNEL_BOARD })
      .leftJoinAndSelect('channelBoard.detail', 'channelBoardDetail');
    if (type === StorageEntityType.CHANNEL_BOARD) {
      query.andWhere('channelBoard.idCatComponentStatus IN (:...channelBoardStatus)', { channelBoardStatus: status });
    }
  }

  public getAllPorts(query: SelectQueryBuilder<StorageEntityEntity>, type: StorageEntityType, systemId: number, status: StorageEntityStatus[]): void {
    query.leftJoinAndSelect('channelBoard.children', 'port', 'port.idType = :portType', { portType: StorageEntityType.PORT })
      .leftJoinAndSelect('port.detail', 'portDetail');
    if (type === StorageEntityType.PORT) {
      query.andWhere('port.idCatComponentStatus IN (:...portStatus)', { portStatus: status });
    }
  }
}
