import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { HttpStatus } from '@nestjs/common';

import { AppModule } from '../src/app.module';
import { ValidateResponseUtils } from '../src/tests/validate-response.utils';
import { FallbackErrorFilter } from '../src/errors/filters/fallback-exception.filter';
import { HttpExceptionFilter } from '../src/errors/filters/http-exception.filter';
import { SaApiExceptionFilter } from '../src/errors/filters/sa-api-exception.filter';
import { StorageEntityType } from '../src/collector/dto/owner.dto';
import { ExternalType } from '../src/collector/enums/external-type.enum';

describe('Externals Controller', () => {
    const SYSTEM_NAME = 'XP7_G12_58416';
    const HOST_GROUP_NAME = 'czchoct007';
    const payload = {
        data: [
            {
                type: 'TIER',
                value: 'T1',
            },
            {
                type: 'TIER',
                value: 'T2',
            },
        ],
    };
    let app;
    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalFilters(
            new FallbackErrorFilter(),
            new HttpExceptionFilter(),
            new SaApiExceptionFilter()
        );
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('Inserting externals, also with update', async () => {
        const expected = expect.objectContaining({
            externals: [
                {
                    type: ExternalType[ExternalType.TIER],
                    value: 'T1',
                },
                {
                    type: ExternalType[ExternalType.TIER],
                    value: 'T2',
                },
            ],
            storageEntity: expect.objectContaining({
                id: expect.any(Number),
                name: HOST_GROUP_NAME,
                type: StorageEntityType[StorageEntityType.HOST_GROUP],
            }),
        });
        await request(app.getHttpServer())
            .post(`/api/v2/storage-entities`)
            .send({
                name: HOST_GROUP_NAME,
                type: StorageEntityType[StorageEntityType.HOST_GROUP],
                parentId: 3,
            })
            .expect(HttpStatus.CREATED)
            .then(async () => {
                return await request(app.getHttpServer())
                    .put(
                        `/api/v1/systems/${SYSTEM_NAME}/host-groups/${HOST_GROUP_NAME}/externals`
                    )
                    .send(payload)
                    .then(async (responses) => {
                        ValidateResponseUtils.validateResponse(
                            responses,
                            expected
                        );
                        const modifiedPayload = payload;
                        modifiedPayload.data = [
                            {
                                type: ExternalType[ExternalType.TIER],
                                value: 'T5',
                            },
                        ];
                        await request(app.getHttpServer())
                            .put(
                                `/api/v1/systems/${SYSTEM_NAME}/host-groups/${HOST_GROUP_NAME}/externals`
                            )
                            .send(modifiedPayload)
                            .then((updateResponse) =>
                                expect(
                                    updateResponse.body.externals.length
                                ).toEqual(1)
                            );
                    });
            });
    });

    it('Host Group not found', () => {
        return request(app.getHttpServer())
            .put(
                `/api/v1/systems/${SYSTEM_NAME}/host-groups/Wrong-hostGroup/externals`
            )
            .send(payload)
            .expect(HttpStatus.NOT_FOUND);
    });
});
