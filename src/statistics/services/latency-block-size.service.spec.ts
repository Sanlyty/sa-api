import { Test } from '@nestjs/testing';

import { OperationType } from '../../collector/enums/operation-type.enum';
import { LatencyData, LatencyMetricService } from '../../collector/services/latency-metric.service';

import { LatencyBlockSizeService, LatencyMetadata, OperationData } from './latency-block-size.service';

describe('LatencyByBlockSizeService', () => {
  let service: LatencyBlockSizeService;
  const mockRepository = { frequencyByLatencyBlockSize: undefined, availableDates: undefined };
  const mockPoolService = { availablePools: undefined };

  function createLatencyEntity(blockSize: number) {
    const latencyData = {} as LatencyData;
    latencyData.blockSize = blockSize;
    latencyData.latency = 0.25;
    latencyData.count = 2000;
    latencyData.operation = OperationType.READ;
    return latencyData;
  }

  beforeEach(async () => {

    const moduleRef = await Test.createTestingModule({
      providers: [
        LatencyBlockSizeService,
        {
          provide: LatencyMetricService,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = await moduleRef.get<LatencyBlockSizeService>(LatencyBlockSizeService);
  });

  it('should return empty array', async () => {
    mockRepository.frequencyByLatencyBlockSize = jest.fn().mockReturnValueOnce([]);
    expect(await service.frequencyByLatencyBlockSize({
      poolIds: [1, 2],
      dates: [new Date('2019-12-30')],
      operations: [OperationType.READ],
      latencies: [],
      blockSizes: [],
    })).toStrictEqual([{
      operation: OperationType.READ,
      values: [],
    } as OperationData]);
  });

  it('should return grouped entities', async () => {
    mockRepository.frequencyByLatencyBlockSize = jest.fn().mockReturnValueOnce([createLatencyEntity(2), createLatencyEntity(4)]);
    const data = {} as OperationData;
    data.operation = OperationType.READ;
    data.values = [
      { x: 2, y: 0.25, z: 2000 },
      { x: 4, y: 0.25, z: 2000 },
    ];
    expect(await service.frequencyByLatencyBlockSize({
      poolIds: [1, 2],
      dates: [new Date('2019-12-30')],
      operations: [OperationType.READ],
      latencies: [],
      blockSizes: [],
    })).toStrictEqual([data]);
  });

  it('should metadata latency', async () => {
    mockRepository.availableDates = jest.fn().mockReturnValueOnce([new Date(2019, 12, 9)]);
    mockPoolService.availablePools = jest.fn().mockReturnValueOnce([{
      idPool: 1,
      name: 'Pool1',
      system: { idSystem: 2, name: 'System2', adapters: [], datacenter: null, hostGroups: [], idDataCenter: 1, metrics: [], pools: [] },
    }]);
    const expectedData: LatencyMetadata = {
      dates: [new Date(2019, 12, 9).toDateString()],
      systems: [{
        id: 1,
        name: 'Pool1',
        pools: [{ id: 2, name: 'System2', metrics: [], ports: [], externals: [] }],
      }],
    };
    expect(await service.getMetaData()).toStrictEqual(expectedData);
  });
});
