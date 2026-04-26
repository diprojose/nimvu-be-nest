import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { PrismaRetryInterceptor } from './prisma/prisma-retry.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(new PrismaRetryInterceptor());

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'https://nimvu-admin.vercel.app',
      'https://nimvu-react-admin.vercel.app',
      'https://nimvu-react-admin-git-master-diprojoses-projects.vercel.app',
      'https://nimvu.vercel.app',
      'https://www.somosnimvu.com',
      'https://somosnimvu.com'
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
