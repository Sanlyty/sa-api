import { ApiProperty } from '@nestjs/swagger';

import { StorageEntityDetailResponseDto } from './storage-entity-detail-response.dto';

export enum StorageEntityType {
  DATACENTER = 1,
  SYSTEM,
  POOL,
  ADAPTER_GROUP,
  PORT_GROUP,
  HOST_GROUP,
  PARITY_GROUP,
  PORT,
  CHANNEL_BOARD,
  DKC,
  CONTROLLER
}

export class Owner {
  @ApiProperty()
  id: number;
  @ApiProperty({ example: 'XP7_B12_5521' })
  name: string;
  @ApiProperty({ example: 'SYSTEM' })
  type: string;
  @ApiProperty({ example: 'ACTIVE' })
  status: string;
  @ApiProperty({ example: '5521' })
  serialNumber: string;
  @ApiProperty({ type: Owner })
  parent: Owner;
  @ApiProperty()
  parentId: number;
  @ApiProperty({ type: Owner })
  children: Owner[] = [];
  @ApiProperty()
  detail: StorageEntityDetailResponseDto;
}
