import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  await app.enableCors(); // Ensure CORS is enabled if needed, moved up or checked. Actually it's already there.
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
