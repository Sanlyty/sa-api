import {
    ArgumentMetadata,
    HttpException,
    HttpStatus,
    Injectable,
    PipeTransform,
} from '@nestjs/common';

import { MetricType } from '../../enums/metric-type.enum';
import { OperationType } from '../../enums/operation-type.enum';

type Query = { metricType: number; operation: number };

@Injectable()
export class MetricRequestPipe implements PipeTransform {
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

        const { metricType, operation } = value;
        const result = { ...value } as Record<string, unknown>;

        if (metricType) {
            const convertedValue = MetricType[metricType];
            if (convertedValue === undefined) {
                throw new HttpException(
                    `Cannot convert '${metricType}' to MetricType value.`,
                    HttpStatus.BAD_REQUEST
                );
            }
            result.metricType = convertedValue;
        }

        if (operation) {
            const convertedValue = OperationType[operation];
            if (convertedValue === undefined) {
                throw new HttpException(
                    `Cannot convert '${operation}' to OperationType value.`,
                    HttpStatus.BAD_REQUEST
                );
            }
            result.operation = convertedValue;
        }

        return result;
    }
}
