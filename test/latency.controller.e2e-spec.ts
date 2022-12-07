import * as request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { OperationType } from '../src/collector/enums/operation-type.enum';
import { MetricType } from '../src/collector/enums/metric-type.enum';
import { OperationData } from '../src/statistics/services/latency-block-size.service';
import { LatencyResponseDto } from '../src/collector/dto/latency-response.dto';
import { StorageEntityType } from '../src/collector/dto/owner.dto';
import { AppModule } from '../src/app.module';

describe('Latency Controller', () => {

  const DATE = '2019-09-12';
  const SYSTEM_NAME = 'XP7_G12_58416';
  const POOL_NAME = 'Pool#6 AFA-T1';
  const payload = {
    metricType: MetricType[MetricType.LATENCY_PER_BLOCK_SIZE],
    date: DATE,
    operation: OperationType[OperationType.READ],
    data: [
      {
        latency: 0.25,
        blockSize: 2,
        count: 500,
      },
      {
        latency: 4,
        blockSize: 16,
        count: 20,
      },
    ],
  };
  let app;
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Create latency metric POST', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/systems/${SYSTEM_NAME}/pools/${encodeURIComponent(POOL_NAME)}/latencyPerBlockSize`)
      .send(payload)
      .expect(HttpStatus.CREATED)
      .then((response) => {
          const responseDto = response.body as LatencyResponseDto;
          return request(app.getHttpServer())
            .post('/api/v1/latency/data')
            .send({
              poolIds: [responseDto.owner.id],
              operations: [responseDto.operation],
              dates: [DATE],
            })
            .expect(HttpStatus.OK)
            .expect([
                {
                  operation: OperationType.READ,
                  values: [
                    { x: 2, y: 0.25, z: 500 },
                    { x: 16, y: 4, z: 20 },
                  ],
                } as OperationData,
              ],
            );
        },
      );
  });

  it('Getting metadata', () => {
    const date = '2019-09-12';
    const expectedMetadata = expect.objectContaining({
        dates: [date],
        systems: [expect.objectContaining(
          {
            name: SYSTEM_NAME,
            type: StorageEntityType[StorageEntityType.SYSTEM],
            children: [
              expect.objectContaining({
                name: POOL_NAME,
                type: StorageEntityType[StorageEntityType.POOL],
              }),
            ],
          }),
        ],
      },
    );

    return request(app.getHttpServer())
      .post(`/api/v1/systems/${SYSTEM_NAME}/pools/${encodeURIComponent(POOL_NAME)}/latencyPerBlockSize`)
      .send(payload).expect(HttpStatus.CREATED)
      .then(
        () => {
          return request(app.getHttpServer())
            .get('/api/v1/latency/metadata')
            .expect(HttpStatus.OK)
            .then((metadataResponse) => expect(metadataResponse.body).toEqual(expectedMetadata));
        },
      );
  });
});
