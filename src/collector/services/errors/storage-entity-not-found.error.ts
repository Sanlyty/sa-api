import { HttpStatus } from '@nestjs/common';

import { SaApiException } from '../../../errors/sa-api.exception';
import { ErrorCodeConst } from '../../../errors/error-code.enum';

export class StorageEntityNotFoundError extends SaApiException {
  constructor(msg: string) {
    super(ErrorCodeConst.ENTITY_NOT_FOUND, msg, HttpStatus.NOT_FOUND);
  }
}
