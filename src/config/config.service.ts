import path from 'path';

import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';

const { env } = process;

dotenv.config();

if (env.CONF_SA_API_PATH) {
    path.join(env.CONF_SA_API_PATH, 'application.env');
}

const ensureExists = (key: string, sev: 'error' | 'warn') => {
    if (!env[key]?.length) {
        if (sev === 'warn') {
            console.warn(`Missing env var '${key}'`);
        } else {
            console.error(
                `Missing env var '${key}', this env var is mandatory.`
            );
            process.exit(1);
        }
    }
};

@Injectable()
export class ConfigService {
    constructor() {
        ensureExists('DATABASE_URL', 'error');
        ensureExists('CONF_MAINTAINER_MAP', 'warn');
    }

    getMaintainerConfPath(): string | undefined {
        return env.CONF_MAINTAINER_MAP;
    }

    getDatabaseSettings() {
        const prod = env.NODE_ENV === 'production';

        const url = new URL(env.DATABASE_URL);

        if (url.protocol !== 'postgres:') {
            console.error(`Invalid database protocol '${url.protocol}'`);
            process.exit(0);
        }

        return {
            host: url.hostname,
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
        const [user, pass] = (env.smtp_auth ?? '')
            .split(':')
            .map((s) => s.trim() || undefined);

        return {
            host,
            port: port ? Number.parseInt(port) : undefined,
            auth: user || pass ? { user, pass } : undefined,
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

    getSmtpMaintenanceTo(): string[] | undefined {
        return env.smtp_maintenance_to?.split(',');
    }

    getCachePath(): string | undefined {
        return env.CACHE_PATH;
    }

    getDebugPrefetchDate(): string | undefined {
        return env.DEBUG_PREFETCH_DATE;
    }

    getMaxParallel(): number | undefined {
        return env.MAX_PARALLEL ? Number.parseInt(env.MAX_PARALLEL) : undefined;
    }

    getPublicUrl(): string {
        return env.PUBLIC_URL ?? 'http://localhost:4200';
    }
}
