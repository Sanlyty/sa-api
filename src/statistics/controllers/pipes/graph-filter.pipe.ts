import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { MetricType } from '../../../collector/enums/metric-type.enum';

type Query = { types?: unknown[] };

@Injectable()
export class GraphFilterPipe implements PipeTransform {
    transform(value: Query, { type }: ArgumentMetadata) {
        return type === 'query' ? this.transformQuery(value) : value;
    }

    transformQuery(value: Query) {
        if (Array.isArray(value?.types)) {
            value.types = value.types.map((type) => MetricType[type]);
        }

        return value;
    }
}
