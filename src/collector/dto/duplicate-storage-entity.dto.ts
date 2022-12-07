import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

import { StorageEntityType } from './owner.dto';

export class DuplicateStorageEntityDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name: string;

  @ApiProperty()
  serialNumber: string;

  @ApiProperty()
  prefixReferenceId: string;

  @IsNotEmpty({ message: 'Types cannot be empty' })
  @ApiProperty({
    enumName: 'StorageEntityType',
    enum: StorageEntityType,
    isArray: true
  })
  types: StorageEntityType[];
}