import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { StorageEntityDetailsEntity } from '../entities/storage-entity-details.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { StorageEntityDetailRequestDto } from '../dto/storage-entity-detail-request.dto';
import { isEmpty } from '@nestjs/common/utils/shared.utils';

@Injectable()
export class SystemDetailsService {
    constructor(
        @InjectRepository(StorageEntityDetailsEntity)
        private readonly systemDetailsRepository: Repository<StorageEntityDetailsEntity>
    ) {}

    public async upsert(id: number, request: StorageEntityDetailRequestDto) {
        let entity = await this.systemDetailsRepository.findOne(id);
        if (entity === undefined) {
            entity = new StorageEntityDetailsEntity();
            entity.id = id;
        }
        entity.model = request.arrayModel;
        entity.dkc = request.dkc;
        entity.managementIp = request.managementIp;
        entity.rack = request.rack;
        entity.room = request.room;
        entity.prefixReferenceId = request.prefixReferenceId;
        entity.sortId = isEmpty(request.sortId) ? null : request.sortId;
        entity.speed = request.speed;
        entity.note = request.note;
        entity.cables = request.cables;
        entity.switch = request.switch;
        entity.slot = request.slot;
        entity.wwn = request.wwn;
        entity.covers = request.covers;
        entity.automation = request.automation;

        return await this.systemDetailsRepository.save(entity);
    }
}
