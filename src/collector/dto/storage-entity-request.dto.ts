import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

import { StorageEntityType } from './owner.dto';

export class StorageEntityRequestDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name: string;

  @ApiProperty()
  @ApiProperty()
  serialNumber: string;

  @IsNotEmpty({ message: 'Entity type cannot be empty' })
  @ApiProperty({
    enumName: 'StorageEntityType',
    enum: StorageEntityType,
  })
  type: StorageEntityType;

  @ApiProperty()
  // @IsNotEmpty({ message: 'Parent ID cannot be empty' })
  parentId: number;
}
