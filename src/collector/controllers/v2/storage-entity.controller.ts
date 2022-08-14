import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { StorageEntityResponseDto } from '../../dto/storage-entity-response.dto';
import { StorageEntityService } from '../../services/storage-entity.service';
import { StorageEntityRequestDto } from '../../dto/storage-entity-request.dto';
import { StorageEntityTransformer } from '../../transformers/storage-entity.transformer';
import { StorageEntityRequestPipe } from '../../dto/pipes/storage-entity-request.pipe';
import {
    ApiCreatedResponse,
    ApiNoContentResponse,
    ApiOkResponse,
} from '@nestjs/swagger';
import { StorageEntityDetailRequestDto } from '../../dto/storage-entity-detail-request.dto';
import { StorageEntityStatusPipe } from '../../dto/pipes/storage-entity-status.pipe';
import { ChangeStatusRequestDto } from '../../dto/change-status-request.dto';
import { StorageEntityType } from '../../dto/owner.dto';
import { DuplicateStorageEntityDto } from '../../dto/duplicate-storage-entity.dto';
import { DuplicateStorageEntityRequestPipe } from '../../dto/pipes/duplicate-storage-entity-request.pipe';
import { StorageEntityStatus } from '../../enums/storage-entity-status.enum';
import { StorageEntityTypePipe } from '../../dto/pipes/storage-entity-type.pipe';

@Controller('api/v2/storage-entities')
export class StorageEntityController {
    constructor(private storageEntityService: StorageEntityService) {}

    @Get()
    public async getAll(
        @Query('type', StorageEntityTypePipe)
        type: StorageEntityType = StorageEntityType.SYSTEM,
        @Query('systemId') systemId: number = null,
        @Query('status', StorageEntityStatusPipe)
        statuses: StorageEntityStatus[]
    ): Promise<StorageEntityResponseDto[]> {
        const entities = await this.storageEntityService.getAllSystems(
            type,
            systemId,
            statuses
        );
        return StorageEntityTransformer.transformAll(entities, true, true);
    }

    @Get('ports')
    public async getPorts() {
        const entities = await this.storageEntityService.getAllSystems(
            StorageEntityType.PORT,
            undefined,
            [StorageEntityStatus.ACTIVE]
        );

        const map = {};

        entities
            .flatMap((dc) => dc.children)
            .forEach((system) => {
                map[system.name] = system.children.flatMap((dkc) =>
                    dkc.children.flatMap((ctl) =>
                        ctl.children.flatMap((cha) =>
                            cha.children.map((port) => ({
                                ...port.detail,
                                name: port.name,
                                dkc: dkc.name,
                                ctl: ctl.name,
                                cha: cha.name,
                            }))
                        )
                    )
                );
            });

        return map;
    }

    @Post()
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiCreatedResponse({
        description: 'Storage entity created',
        type: StorageEntityResponseDto,
    })
    public async createStorageEntity(
        @Body(new StorageEntityRequestPipe()) request: StorageEntityRequestDto
    ): Promise<StorageEntityResponseDto> {
        const entity = await this.storageEntityService.create(request);
        return StorageEntityTransformer.transform(entity);
    }

    @Post(':id/duplicate')
    @UsePipes(new ValidationPipe({ transform: true }))
    @ApiCreatedResponse({
        description:
            'Duplicate storage entity and all children up to storage type, defined as parameter',
        type: StorageEntityResponseDto,
    })
    public async duplicateSystem(
        @Param('id') id: number,
        @Body(new DuplicateStorageEntityRequestPipe())
        request: DuplicateStorageEntityDto
    ): Promise<StorageEntityResponseDto> {
        const entity = await this.storageEntityService.duplicate(request, id);
        return StorageEntityTransformer.transform(entity);
    }

    @Put(':id')
    @ApiOkResponse({
        description: 'Record updated',
        type: StorageEntityResponseDto,
    })
    public async addDetails(
        @Param('id') id: number,
        @Body(new StorageEntityRequestPipe())
        request: StorageEntityDetailRequestDto
    ): Promise<StorageEntityResponseDto> {
        const entity = await this.storageEntityService.update(id, request);
        return StorageEntityTransformer.transform(entity);
    }

    @Delete(':id')
    @ApiNoContentResponse()
    public async delete(@Param('id') id: number) {
        await this.storageEntityService.delete(id);
    }

    @Put(':id/new-parent/:parent')
    @ApiNoContentResponse()
    public async move(
        @Param('id') id: number,
        @Param('parent') parentId: number
    ) {
        await this.storageEntityService.move(id, parentId);
    }

    @Put(':id/status')
    @ApiNoContentResponse()
    public async changeStatus(
        @Param('id') id: number,
        @Body(new StorageEntityStatusPipe()) dto: ChangeStatusRequestDto
    ) {
        const storageEntity = await this.storageEntityService.updateStatusById(
            id,
            dto
        );
        return StorageEntityTransformer.transform(storageEntity);
    }
}
