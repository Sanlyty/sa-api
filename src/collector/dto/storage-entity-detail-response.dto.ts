import { ApiProperty } from '@nestjs/swagger';

export class StorageEntityDetailResponseDto {
    @ApiProperty()
    name: string;
    @ApiProperty()
    serialNumber: string;
    @ApiProperty({ required: false })
    arrayModel: string;
    @ApiProperty({ required: false })
    dkc: string;
    @ApiProperty({ required: false })
    managementIp: string;
    @ApiProperty({ required: false })
    rack: string;
    @ApiProperty({ required: false })
    prefixReferenceId: string;
    @ApiProperty({ required: false })
    room: string;
    @ApiProperty({ required: false })
    sortId: number;
    @ApiProperty({ required: false })
    speed: number;
    @ApiProperty({ required: false })
    note: string;
    @ApiProperty({ required: false })
    cables: string;
    @ApiProperty({ required: false })
    switch: string;
    @ApiProperty({ required: false })
    slot: string;
    @ApiProperty({ required: false })
    covers?: string;
    @ApiProperty({ required: false })
    automation?: boolean;
    @ApiProperty({ required: false })
    wwn: string;
}
