import { HttpStatus } from '@nestjs/common';

import { SaApiException } from '../../../errors/sa-api.exception';
import { ErrorCode } from '../../../errors/error-code.enum';

export class ArgumentError extends SaApiException {
  constructor(code: ErrorCode, msg: string) {
    super(code, msg, HttpStatus.BAD_REQUEST);
  }
}
