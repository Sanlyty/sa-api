import { HttpStatus } from '@nestjs/common';

import { SaApiException } from '../../../errors/sa-api.exception';
import { ErrorCodeConst } from '../../../errors/error-code.enum';

export class StorageEntityAlreadyExistsError extends SaApiException {
  constructor(msg: string) {
    super(ErrorCodeConst.ENTITY_ALREADY_EXISTS, msg, HttpStatus.CONFLICT);
  }
}
