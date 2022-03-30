import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

@Injectable()
export class ConfigService {
    private readonly envConfig: { [key: string]: string };

    constructor() {
        this.envConfig = dotenv.parse(
            fs.readFileSync(`${process.env.CONF_SA_API_PATH}application.env`)
        );
    }

    getDatabaseSettings() {
        const cfg = this.envConfig;
        const production = process.env.NODE_ENV === 'production';

        return {
            host: cfg.db_host,
            port: parseInt(cfg.db_port),
            username: cfg.db_username,
            password: cfg.db_password,
            database: cfg.db_database,
            synchronize: !production && cfg.db_synchronize === 'true',
            dropSchema: !production && cfg.db_dropSchema === 'true',
            logging: cfg.db_logging === 'true',
            migrations: [this.envConfig.db_migrations ?? 'dist/migration/*.js'],
        };
    }
}
