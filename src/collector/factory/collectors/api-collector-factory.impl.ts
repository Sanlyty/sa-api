import { ApiCollectorFactory } from '../api-collector-factory.interface';
import { CollectorType } from '../collector-type.enum';
import { Injectable } from '@nestjs/common';
import { HostGroupCollectorFactoryImpl } from './host-group-collector-factory.impl';
import { CollectorFactory } from '../collector-factory.interface';
import { PoolCollectorFactoryImpl } from './pool-collector-factory.impl';
import { ChaCollectorFactoryImpl } from './cha-collector-factory.impl';
import { SystemCollectorFactoryImpl } from './system-collector-factory.impl';

@Injectable()
export class ApiCollectorFactoryImpl implements ApiCollectorFactory {
  constructor(
    private hostGroupCollectorFactory: HostGroupCollectorFactoryImpl,
    private poolCollectorFactory: PoolCollectorFactoryImpl,
    private chaCollectorFactory: ChaCollectorFactoryImpl,
    private systemCollectorFactory: SystemCollectorFactoryImpl,
  ) {

  }

  getCollector(type: CollectorType): CollectorFactory<any> {
    switch (type) {
      case CollectorType.HOST_GROUPS:
        return this.hostGroupCollectorFactory;
      case CollectorType.POOLS:
        return this.poolCollectorFactory;
      case CollectorType.CHAS:
        return this.chaCollectorFactory;
      case CollectorType.SYSTEMS:
        return this.systemCollectorFactory;
    }
  }

}
