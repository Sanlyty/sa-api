import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

import { OperationType } from '../../../collector/enums/operation-type.enum';

type Query = { operations?: unknown[] };

@Injectable()
export class LatencyRequestPipe implements PipeTransform {
    transform(value: Query, { type }: ArgumentMetadata) {
        return type === 'body' ? this.transformOperation(value) : value;
    }

    transformOperation(value: Query) {
        if (Array.isArray(value?.operations)) {
            value.operations = value.operations.map(
                (type) => OperationType[type]
            );
        }

        return value;
    }
}
