import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { CatExternalTypeEntity } from '../entities/cat-external-type.entity';

export class ExternalTypeService {
    constructor(
        @InjectRepository(CatExternalTypeEntity)
        private repository: Repository<CatExternalTypeEntity>
    ) {}

    public async findById(idType) {
        return await this.repository.findOne({
            where: { idCatExternalType: idType },
        });
    }
}
