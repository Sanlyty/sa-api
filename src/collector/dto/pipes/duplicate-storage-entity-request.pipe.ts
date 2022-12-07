import {
    ArgumentMetadata,
    HttpException,
    HttpStatus,
    Injectable,
    PipeTransform,
} from '@nestjs/common';

import { StorageEntityType } from '../owner.dto';

type Query = { types: number[] };

@Injectable()
export class DuplicateStorageEntityRequestPipe implements PipeTransform {
    transform(value: Query, metadata: ArgumentMetadata) {
        const { type } = metadata;

        return type === 'body' ? this.transformQuery(value) : value;
    }

    transformQuery(value: Query) {
        if (typeof value !== 'object' || !value) {
            return value;
        }

        const { types } = value;
        if (types) {
            return {
                ...value,
                types: types.map((item) => {
                    const convertedValue = StorageEntityType[item];
                    if (convertedValue === undefined) {
                        throw new HttpException(
                            `Cannot convert '${item}' to StorageEntityType value.`,
                            HttpStatus.BAD_REQUEST
                        );
                    }
                    return convertedValue;
                }),
            };
        }
        return value;
    }
}
