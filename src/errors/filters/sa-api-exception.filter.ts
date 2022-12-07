import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

import { ErrorDto } from '../error.dto';
import { SaApiException } from '../sa-api.exception';
import { EntityServiceError } from '../../collector/services/errors/entity-service.error';

@Catch(SaApiException, EntityServiceError)
export class SaApiExceptionFilter implements ExceptionFilter {
  catch(exception: SaApiException, host: ArgumentsHost) {
    // this.catch(exception, host);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const error = new ErrorDto();
    error.message = exception.message;
    error.detail = exception.detailMessage;
    error.code = exception.errorCode;

    response.status(status)
      .json(error);
  }
}
