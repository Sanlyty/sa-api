import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonLoggerService } from './winston-logger.service';
import { SaApiExceptionFilter } from './errors/filters/sa-api-exception.filter';
import { FallbackErrorFilter } from './errors/filters/fallback-exception.filter';
import { HttpExceptionFilter } from './errors/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: new WinstonLoggerService('app'),
    });
    app.enableCors({
        methods: 'GET, OPTIONS, POST, PUT, DELETE',
        origin: '*',
        allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept',
    });
    app.useGlobalFilters(
        new FallbackErrorFilter(),
        new HttpExceptionFilter(),
        new SaApiExceptionFilter()
    );

    const options = new DocumentBuilder().setTitle('SA REST API').build();
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('api', app, document);

    await app.listen(process.env.SA_PORT ?? 3000);
}

bootstrap();
