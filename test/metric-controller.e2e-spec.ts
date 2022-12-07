import * as request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { MetricType } from '../src/collector/enums/metric-type.enum';
import { StorageEntityType } from '../src/collector/dto/owner.dto';
import { StorageEntityStatus } from '../src/collector/enums/storage-entity-status.enum';
import { AppModule } from '../src/app.module';
import { ValidateResponseUtils } from '../src/tests/validate-response.utils';
import { FallbackErrorFilter } from '../src/errors/filters/fallback-exception.filter';
import { HttpExceptionFilter } from '../src/errors/filters/http-exception.filter';
import { SaApiExceptionFilter } from '../src/errors/filters/sa-api-exception.filter';

describe('Collector', () => {
  let app;
  const SYSTEM_NAME = 'XP7_G11_58417';
  const SYSTEM_NAME_2 = 'XP7_G12_58416';
  const POOL_NAME = 'Pool123';
  const HOST_GROUP_NAME = 'czchoct007';
  const ADAPTER_NAME = 'CHA-1PC,CHA-33PC';
  const PORT_NAME = '1D,2D';
  const DATE = '2019-07-15';
  const DATE_2 = '2019-07-16';
  const METRIC_VALUE = 12345;
  const poolMetricPayload = {
    metricType: MetricType[MetricType.PHYSICAL_CAPACITY],
    value: METRIC_VALUE,
    date: DATE,
  };
  const hostGroupMetricPayload = {
    metricType: MetricType[MetricType.NET_TOTAL],
    value: METRIC_VALUE,
    date: DATE,
  };

  const adapterMetricPayload = {
    metricType: MetricType[MetricType.IMBALANCE_ABSOLUT],
    value: METRIC_VALUE,
    date: DATE,
  };

  const systemMetricPayload = {
    metricType: MetricType[MetricType.WORKLOAD],
    value: METRIC_VALUE,
    peak: 5,
    date: DATE,
  };

  const portMetricPayload = {
    metricType: MetricType[MetricType.IMBALANCE_EVENTS],
    value: METRIC_VALUE,
    date: DATE,
  };
  const changeStatusPayload = {
    status: StorageEntityStatus[StorageEntityStatus.INACTIVE],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new FallbackErrorFilter(), new HttpExceptionFilter(), new SaApiExceptionFilter());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('Create pool metric (POST)', () => {
    const expected = expect.objectContaining({
      idMetric: expect.any(Number),
      date: DATE,
      value: METRIC_VALUE,
      metricType: MetricType[MetricType.PHYSICAL_CAPACITY],
      owner: expect.objectContaining({
        id: expect.any(Number),
        name: POOL_NAME,
        type: StorageEntityType[StorageEntityType.POOL],
        status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
        parent: expect.objectContaining({
          id: expect.any(Number),
          name: SYSTEM_NAME,
          type: StorageEntityType[StorageEntityType.SYSTEM],
          status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
        }),
      }),
    });
    return request(app.getHttpServer())
      .post(`/api/v1/systems/${SYSTEM_NAME}/pools/${POOL_NAME}/metrics`)
      .send(poolMetricPayload)
      .expect(HttpStatus.CREATED)
      .then((response) => ValidateResponseUtils.validateResponse(response, expected));
  });

  it('Update pool metric (POST)', () => {
    poolMetricPayload.date = DATE_2;
    const expected = expect.objectContaining({
      idMetric: expect.any(Number),
      date: DATE_2,
      value: METRIC_VALUE,
      metricType: MetricType[MetricType.PHYSICAL_CAPACITY],
      owner: expect.objectContaining({
        id: expect.any(Number),
        name: POOL_NAME,
        type: StorageEntityType[StorageEntityType.POOL],
        status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
        parent: expect.objectContaining({
          id: expect.any(Number),
          name: SYSTEM_NAME,
          type: StorageEntityType[StorageEntityType.SYSTEM],
          status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
        }),
      }),
    });
    return request(app.getHttpServer())
      .post(`/api/v1/systems/${SYSTEM_NAME}/pools/${POOL_NAME}/metrics`)
      .send(poolMetricPayload)
      .expect(HttpStatus.CREATED)
      .then(async (response) => {
        ValidateResponseUtils.validateResponse(response, expected);
        poolMetricPayload.value = 555;
        await request(app.getHttpServer())
          .post(`/api/v1/systems/${SYSTEM_NAME}/pools/${POOL_NAME}/metrics`)
          .send(poolMetricPayload)
          .expect(HttpStatus.CREATED)
          .then((secondResponse) => {
            expect(secondResponse.body.id).toEqual(response.body.id);
            expect(secondResponse.body.value).toEqual(555);
          });
      });
  });

  it('Create host group metric (POST)', () => {
    const expected = expect.objectContaining({
        idMetric: expect.any(Number),
        date: DATE,
        value: METRIC_VALUE,
        metricType: MetricType[MetricType.NET_TOTAL],
        owner: expect.objectContaining({
          id: expect.any(Number),
          name: HOST_GROUP_NAME,
          status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
          type: StorageEntityType[StorageEntityType.HOST_GROUP],
          parent: expect.objectContaining({
            id: expect.any(Number),
            name: SYSTEM_NAME,
            status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
            type: StorageEntityType[StorageEntityType.SYSTEM],
          }),
        }),
      },
    );
    return request(app.getHttpServer())
      .post(`/api/v1/systems/${SYSTEM_NAME}/host-groups/${HOST_GROUP_NAME}/metrics`)
      .send(hostGroupMetricPayload)
      .expect(HttpStatus.CREATED)
      .then((responses) => ValidateResponseUtils.validateResponse(responses, expected));
  });

  it('Create system metric (POST)', () => {
    const expected = expect.objectContaining({
      idMetric: expect.any(Number),
      date: DATE,
      value: METRIC_VALUE,
      peak: 5,
      metricType: MetricType[MetricType.WORKLOAD],
      owner: expect.objectContaining({
        id: expect.any(Number),
        name: SYSTEM_NAME,
        type: StorageEntityType[StorageEntityType.SYSTEM],
        status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
      }),
    });
    return request(app.getHttpServer())
      .post(`/api/v1/systems/${SYSTEM_NAME}/metrics`)
      .send(systemMetricPayload)
      .expect(HttpStatus.CREATED)
      .then((responses) => ValidateResponseUtils.validateResponse(responses, expected));
  });

  it('Create adapter metric (POST)', () => {
    const expected = expect.objectContaining({
      idMetric: expect.any(Number),
      date: DATE,
      value: METRIC_VALUE,
      metricType: MetricType[MetricType.IMBALANCE_ABSOLUT],
      owner: expect.objectContaining({
        id: expect.any(Number),
        name: ADAPTER_NAME,
        type: StorageEntityType[StorageEntityType.ADAPTER_GROUP],
        status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
        parent: expect.objectContaining({
          id: expect.any(Number),
          name: SYSTEM_NAME,
          type: StorageEntityType[StorageEntityType.SYSTEM],
          status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
        }),
      }),
    });
    return request(app.getHttpServer())
      .post(`/api/v1/systems/${SYSTEM_NAME}/chas/${ADAPTER_NAME}/metrics`)
      .send(adapterMetricPayload)
      .expect(HttpStatus.CREATED)
      .then((responses) => ValidateResponseUtils.validateResponse(responses, expected));
  });

  it('Create port metric (POST)', () => {
    const expected = expect.objectContaining({
      idMetric: expect.any(Number),
      date: DATE,
      value: METRIC_VALUE,
      metricType: MetricType[MetricType.IMBALANCE_EVENTS],
      owner: expect.objectContaining({
        id: expect.any(Number),
        name: PORT_NAME,
        type: StorageEntityType[StorageEntityType.PORT_GROUP],
        status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
        parent: expect.objectContaining({
          id: expect.any(Number),
          name: ADAPTER_NAME,
          type: StorageEntityType[StorageEntityType.ADAPTER_GROUP],
          status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
          parent: expect.objectContaining({
            id: expect.any(Number),
            name: SYSTEM_NAME,
            type: StorageEntityType[StorageEntityType.SYSTEM],
            status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
          }),
        }),
      }),
    });
    return request(app.getHttpServer())
      .post(`/api/v1/systems/${SYSTEM_NAME}/chas/${encodeURIComponent(ADAPTER_NAME)}/ports/${encodeURIComponent(PORT_NAME)}/metrics`)
      .send(portMetricPayload)
      .expect(HttpStatus.CREATED)
      .then((responses) => ValidateResponseUtils.validateResponse(responses, expected));
  });

  it('Update pool status (POST)', () => {
    const expected = {
      storageEntity: expect.objectContaining({
        id: expect.any(Number),
        name: POOL_NAME,
        status: StorageEntityStatus[StorageEntityStatus.INACTIVE],
        type: StorageEntityType[StorageEntityType.POOL],
        parent: expect.objectContaining({
          id: expect.any(Number),
          name: SYSTEM_NAME,
          type: StorageEntityType[StorageEntityType.SYSTEM],
          status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
        }),
      }),
      externals: [],
    };
    return request(app.getHttpServer())
      .put(`/api/v1/systems/${SYSTEM_NAME}/pools/${POOL_NAME}/status`)
      .send(changeStatusPayload)
      .expect(HttpStatus.OK)
      .then((responses) => ValidateResponseUtils.validateResponse(responses, expected));
  });

  it('Update host group status (POST)', () => {
    const expected = {
      storageEntity: expect.objectContaining({
        id: expect.any(Number),
        name: HOST_GROUP_NAME,
        status: StorageEntityStatus[StorageEntityStatus.INACTIVE],
        type: StorageEntityType[StorageEntityType.HOST_GROUP],
        parent: expect.objectContaining({
          id: expect.any(Number),
          name: SYSTEM_NAME,
          type: StorageEntityType[StorageEntityType.SYSTEM],
          status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
        }),
      }),
      externals: [],
    };
    return request(app.getHttpServer())
      .put(`/api/v1/systems/${SYSTEM_NAME}/host-groups/${HOST_GROUP_NAME}/status`)
      .send(changeStatusPayload)
      .expect(HttpStatus.OK)
      .then((responses) => ValidateResponseUtils.validateResponse(responses, expected));
  });

  it('Update port status (PUT)', () => {
    const expected = {
      storageEntity: expect.objectContaining({
        id: expect.any(Number),
        name: PORT_NAME,
        type: StorageEntityType[StorageEntityType.PORT_GROUP],
        status: StorageEntityStatus[StorageEntityStatus.INACTIVE],
        parent: expect.objectContaining({
          id: expect.any(Number),
          name: ADAPTER_NAME,
          status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
          type: StorageEntityType[StorageEntityType.ADAPTER_GROUP],
          parent: expect.objectContaining({
            id: expect.any(Number),
            name: SYSTEM_NAME,
            type: StorageEntityType[StorageEntityType.SYSTEM],
            status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
          }),
        }),
      }),
      externals: [],
    };
    return request(app.getHttpServer())
      .put(`/api/v1/systems/${SYSTEM_NAME}/chas/${encodeURIComponent(ADAPTER_NAME)}/ports/${encodeURIComponent(PORT_NAME)}/status`)
      .send(changeStatusPayload)
      .expect(HttpStatus.OK)
      .then((responses) => ValidateResponseUtils.validateResponse(responses, expected));
  });

  it('Update adapter status (POST)', () => {
    const expected = {
      storageEntity: expect.objectContaining({
        id: expect.any(Number),
        name: ADAPTER_NAME,
        status: StorageEntityStatus[StorageEntityStatus.INACTIVE],
        type: StorageEntityType[StorageEntityType.ADAPTER_GROUP],
        parent: expect.objectContaining({
          id: expect.any(Number),
          name: SYSTEM_NAME,
          type: StorageEntityType[StorageEntityType.SYSTEM],
          status: StorageEntityStatus[StorageEntityStatus.ACTIVE],
        }),
      }),
      externals: [],
    };
    return request(app.getHttpServer())
      .put(`/api/v1/systems/${SYSTEM_NAME}/chas/${encodeURIComponent(ADAPTER_NAME)}/status`)
      .send(changeStatusPayload)
      .expect(HttpStatus.OK)
      .then((responses) => ValidateResponseUtils.validateResponse(responses, expected));
  });

  it('Update adapter status when not exists(PUT)', () => {
    return request(app.getHttpServer())
      .put(`/api/v1/systems/${SYSTEM_NAME}/chas/ChaXXX/status`)
      .send(changeStatusPayload)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('Update system status (PUT)', () => {
    const expected = {
      storageEntity: expect.objectContaining({
          name: SYSTEM_NAME_2,
          status: StorageEntityStatus[StorageEntityStatus.INACTIVE],
          type: StorageEntityType[StorageEntityType.SYSTEM],
        },
      ),
      externals: [],
    };
    return request(app.getHttpServer())
      .put(`/api/v1/systems/${SYSTEM_NAME_2}/status`)
      .send(changeStatusPayload)
      .expect(HttpStatus.OK)
      .then((responses) => ValidateResponseUtils.validateResponse(responses, expected));
  });
});
