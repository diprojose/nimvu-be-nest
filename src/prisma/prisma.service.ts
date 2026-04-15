import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL!;
  const url = new URL(base);
  // Transaction mode (puerto 6543) con Supabase Supavisor:
  // - pgbouncer=true: deshabilita prepared statements, requerido para transaction mode.
  // - connection_limit=10: en transaction mode cada conexión se libera tras cada query,
  //   10 conexiones son suficientes para cientos de requests simultáneos.
  // - pool_timeout=30: tiempo máximo de espera para obtener una conexión libre.
  url.searchParams.set('pgbouncer', 'true');
  url.searchParams.set('connection_limit', '10');
  url.searchParams.set('pool_timeout', '30');
  return url.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: { url: buildDatabaseUrl() },
      },
    });
    this.logger.log('PrismaService initialized (lazy connect, Transaction mode)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
