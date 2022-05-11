import {
    ArgumentMetadata,
    HttpException,
    HttpStatus,
    Injectable,
    PipeTransform,
} from '@nestjs/common';
import { StorageEntityType } from '../owner.dto';

type Query = number;

@Injectable()
export class StorageEntityTypePipe implements PipeTransform {
    transform(value: Query, metadata: ArgumentMetadata) {
        const { type } = metadata;
        if (type === 'query') {
            return this.transformQuery(value);
        }

        return value;
    }

    private transformQuery(value: Query) {
        if (typeof value === 'object' || !value) {
            return value;
        }
        if (value) {
            return this.convertValue(value);
        }
    }

    private convertValue(value: Query) {
        const convertedValue = StorageEntityType[value];
        if (convertedValue === undefined) {
            throw new HttpException(
                `Cannot convert '${value}' to StorageEntityType value.`,
                HttpStatus.BAD_REQUEST
            );
        }
        return convertedValue;
    }
}
