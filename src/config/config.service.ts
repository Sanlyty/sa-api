import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import path = require('path');

const { env } = process;

const ensureExists = (key: string, warnOnly?: boolean) => {
    if (!env[key]?.length) {
        if (warnOnly) {
            console.warn(`Missing env var '${key}'`);
        } else {
            console.error(`Missing env var '${key}'`);
            process.exit(1);
        }
    }
};

@Injectable()
export class ConfigService {
    constructor() {
        dotenv.config();

        if (env.CONF_SA_API_PATH) {
            path.join(env.CONF_SA_API_PATH, 'application.env');
        }

        ensureExists('DATABASE_URL');
        ensureExists('CONF_MAINTAINER_MAP', true);
    }

    getDatabaseSettings() {
        const prod = env.NODE_ENV === 'production';

        const url = new URL(env.DATABASE_URL);

        if (url.protocol !== 'postgres:') {
            console.error(`Invalid database protocol '${url.protocol}'`);
            process.exit(0);
        }

        return {
            host: url.host,
            port: Number.parseInt(url.port ?? '5432'),
            username: url.username,
            password: url.password,
            database: url.pathname?.slice(1),
            synchronize: !prod && env.db_synchronize === 'true',
            dropSchema: !prod && env.db_dropSchema === 'true',
            logging: env.db_logging === 'true',
            migrations: [env.db_migrations ?? 'dist/migration/*.js'],
        };
    }

    getSmtpSettings() {
        if (!env.smtp_host) return undefined;

        const [host, port] = env.smtp_host.split(':');
        const [user, pass] = (env.smtp_auth ?? '').split(':');

        return {
            host,
            port: port ? Number(port) : undefined,
            auth:
                user || pass
                    ? { user: user || undefined, pass: pass || undefined }
                    : undefined,
        };
    }

    getSmtpFrom(): string {
        return env.smtp_from;
    }

    getSmtpTo(): string[] | undefined {
        return env.smtp_to?.split(',');
    }

    getSmtpPlainTo(): string[] | undefined {
        return env.smtp_plain_to?.split(',');
    }
}
