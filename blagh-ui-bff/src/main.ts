import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/logging.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Widget payloads include base64-encoded screenshots — raise the default 100 KB limit
  app.use(json({ limit: '10mb' }));

  const corsOrigin = process.env.CORS_ORIGIN || '*';

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Project-ID'],
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const port = process.env.PORT || 4001;
  await app.listen(port);
  logger.log(`Running on http://localhost:${port}`);
  logger.log(`Proxying to: ${process.env.BACKEND_URL || 'http://localhost:8002'}`);
}

bootstrap();
