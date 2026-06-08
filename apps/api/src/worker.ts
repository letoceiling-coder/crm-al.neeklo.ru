import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getAppRole } from './config/app-role';

async function bootstrap() {
  const role = getAppRole();
  if (role === 'api') {
    console.error('APP_ROLE=api — use main.ts for HTTP. Set APP_ROLE=worker-* for workers.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  console.log(`Enterprise worker started — APP_ROLE=${role}`);
  await app.init();
}

bootstrap();
