import { ConsoleLogger } from '@nestjs/common';
import { createLogger, format } from 'winston';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';

const loggerComponent = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'sa-api' },
    transports: [
        new WinstonDailyRotateFile({
            filename: 'logs/sa-api-error.log',
            level: 'error',
            maxSize: '20m',
            maxFiles: '14d',
        }),
        new WinstonDailyRotateFile({
            filename: 'logs/sa-api-combined.log',
            maxSize: '20m',
            maxFiles: '14d',
        }),
    ],
});

export class WinstonLoggerService extends ConsoleLogger {
    private winstonComponent = loggerComponent;

    log(message: string) {
        this.winstonComponent.info(message);
        super.log(message);
    }

    error(message: string, trace: string) {
        this.winstonComponent.error(message);
        super.error(message, trace);
    }

    warn(message: string) {
        this.winstonComponent.warn(message);
        super.warn(message);
    }

    debug(message: string) {
        this.winstonComponent.debug(message);
        super.debug(message);
    }

    verbose(message: string) {
        this.winstonComponent.notice(message);
        super.verbose(message);
    }
}
