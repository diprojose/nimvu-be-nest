import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL!;
  const url = new URL(base);
  // Supabase Pro soporta hasta 200 conexiones directas. Con Render Starter (2 vCPU)
  // un pool de 10 es más que suficiente y deja amplio margen para escalar.
  url.searchParams.set('connection_limit', '10');
  // Tiempo de espera para obtener una conexión del pool (en segundos).
  url.searchParams.set('pool_timeout', '15');
  return url.toString();
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: { url: buildDatabaseUrl() },
      },
    });
  }

  async onModuleInit() {
    // Lazy connections: Prisma conecta solo cuando hace la primera query.
    // Esto recupera bien las conexiones cortadas por inactividad del pooler de Supabase.
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
