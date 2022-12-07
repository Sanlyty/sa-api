import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { CollectorModule } from './collector/collector.module';
import { ConfigService } from './config/config.service';
import { ConfigModule } from './config/config.module';
import { StatisticsModule } from './statistics/statistics.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                ...configService.getDatabaseSettings(),
                type: 'postgres',
                entities: [__dirname + '/**/entities/*{.ts,.js}'],
                migrationsRun: true,
                migrationsTableName: 'migration_schema',
            }),
            inject: [ConfigService],
        }),
        CollectorModule,
        StatisticsModule,
    ],
    providers: [],
})
export class AppModule {}
