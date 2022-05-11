import {
    ArgumentMetadata,
    HttpException,
    HttpStatus,
    Injectable,
    PipeTransform,
} from '@nestjs/common';
import { StorageEntityType } from '../owner.dto';
import { ErrorCodeConst } from '../../../errors/error-code.enum';
import { SaApiException } from '../../../errors/sa-api.exception';

type Query = { type: number; parentId: unknown };

@Injectable()
export class StorageEntityRequestPipe implements PipeTransform {
    transform(value: Query, metadata: ArgumentMetadata) {
        const { type } = metadata;
        if (type === 'body') {
            return this.transformQuery(value);
        }

        return value;
    }

    transformQuery(value: Query) {
        if (typeof value !== 'object' || !value) {
            return value;
        }

        const { type, parentId } = value;
        if (type) {
            const convertedValue = StorageEntityType[type];
            if (convertedValue === undefined) {
                throw new HttpException(
                    `Cannot convert '${type}' to StorageEntityType value.`,
                    HttpStatus.BAD_REQUEST
                );
            }
            value.type = convertedValue as unknown as number;
        }
        if (value.type !== StorageEntityType.DATACENTER && parentId === null) {
            throw new SaApiException(
                ErrorCodeConst.BAD_INPUT,
                `Storage entity of type '${type}' must have 'parentId' property specified.`,
                HttpStatus.BAD_REQUEST
            );
        }
        return value;
    }
}
