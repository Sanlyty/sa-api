import {
    ArgumentMetadata,
    HttpException,
    HttpStatus,
    Injectable,
    PipeTransform,
} from '@nestjs/common';

import { StorageEntityStatus } from '../../enums/storage-entity-status.enum';

type Query = { status: Subquery };
type Subquery = number | number[];

@Injectable()
export class StorageEntityStatusPipe implements PipeTransform {
    transform(value: Query | Subquery, metadata: ArgumentMetadata) {
        const { type } = metadata;
        if (type === 'body') {
            return this.transformBody(value as Query);
        } else if (type === 'query') {
            return this.transformQuery(value as Subquery);
        }

        return value;
    }

    transformBody(value: Query) {
        if (typeof value !== 'object' || !value) {
            return value;
        }

        const { status } = value;
        if (status) {
            value.status = this.convertValue(status)[0];
        }

        return value;
    }

    private transformQuery(value: Subquery) {
        if ((typeof value === 'object' && !Array.isArray(value)) || !value) {
            return value;
        }
        if (value) {
            return this.convertValue(value);
        }
    }

    private convertValue(value: Subquery) {
        let convertedValue;
        if (Array.isArray(value)) {
            convertedValue = value.map((val) => StorageEntityStatus[val]);
        } else {
            convertedValue = [StorageEntityStatus[value]];
        }

        if (convertedValue === undefined) {
            throw new HttpException(
                `Cannot convert '${value}' to ComponentStatus value.`,
                HttpStatus.BAD_REQUEST
            );
        }
        return convertedValue;
    }
}
