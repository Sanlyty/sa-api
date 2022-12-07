import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpStatus,
    Logger,
} from '@nestjs/common';

import { ErrorDto } from '../error.dto';
import { ErrorCodeConst } from '../error-code.enum';

@Catch()
export class FallbackErrorFilter implements ExceptionFilter {
    private static logger = new Logger('FallbackErrorFilter');

    catch(exception: Error, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        const error = new ErrorDto();
        error.message = ErrorCodeConst.UNKNOWN_ERROR.message;
        error.code = ErrorCodeConst.UNKNOWN_ERROR.code;

        FallbackErrorFilter.logger.error(
            `Error: ${exception.message},
Stack: ${exception.stack}
      `
        );

        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(error);
    }
}
