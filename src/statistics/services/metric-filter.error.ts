import { HttpStatus } from '@nestjs/common';

import { SaApiException } from '../../errors/sa-api.exception';
import { ErrorCodeConst } from '../../errors/error-code.enum';

export class MetricFilterError extends SaApiException {
    constructor(msg: string) {
        super(ErrorCodeConst.BAD_INPUT, msg, HttpStatus.BAD_REQUEST);
    }
}
