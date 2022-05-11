import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

class RequestLogMessage {
    execTime;
    responseBody;
    error;

    constructor(private body, private path, private headers, private params) {}
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept<T>(
        context: ExecutionContext,
        next: CallHandler<T>
    ): Observable<T> {
        const request = context.getArgs()[0];
        if (request === undefined) {
            return;
        }

        const message = new RequestLogMessage(
            request.body,
            request.originalUrl,
            request.headers,
            request.params
        );

        const now = Date.now();
        return next.handle().pipe(
            map((data) => (message.responseBody = data)),
            tap(() => {
                message.execTime = Date.now() - now;
                this.logger.log(message);
            }),
            catchError((err) => {
                message.error = err;
                this.logger.error(message);
                return throwError(err);
            })
        );
    }
}
