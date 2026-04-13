import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL!;
  const url = new URL(base);
  // Supabase Pro permite hasta ~200 conexiones en el pooler Session mode.
  // Con Render Starter (2 vCPU) y tráfico real de ventas, 20 es cómodo y seguro.
  url.searchParams.set('connection_limit', '20');
  // 30s para esperar una conexión libre antes de fallar.
  url.searchParams.set('pool_timeout', '30');
  return url.toString();
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: { url: buildDatabaseUrl() },
      },
    });
  }

  async onModuleInit() {
    // Con Supabase Pro la BD nunca se pausa, así que pre-calentamos el pool
    // al arrancar para que las primeras peticiones no esperen establecer conexiones.
    await this.$connect();
    this.logger.log('Database connection pool initialized');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
