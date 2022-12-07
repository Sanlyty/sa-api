import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorCode } from './error-code.enum';

export class SaApiException extends HttpException {

  detailMessage: string;
  errorCode: number;

  constructor(errorCode: ErrorCode, message: string, httpCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(errorCode.message, httpCode);
    this.detailMessage = message;
    this.errorCode = errorCode.code;
  }
}
