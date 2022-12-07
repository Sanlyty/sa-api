import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

import { ErrorDto } from '../error.dto';
import { ErrorCodeConst } from '../error-code.enum';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const error = new ErrorDto();
    error.message = exception.getStatus().toString();
    error.detail = exception.message;
    error.code = ErrorCodeConst.HTTP_ERROR.code ;

    response.status(status)
      .json(error);
  }
}
