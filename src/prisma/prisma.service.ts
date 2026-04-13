import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL!;
  const url = new URL(base);
  // Transaction mode (puerto 6543) con Supabase Supavisor:
  // - pgbouncer=true: deshabilita prepared statements para compatibilidad con PgBouncer.
  //   Sin este flag, Prisma puede dejar conexiones colgadas en transaction mode, causando P2024.
  // - connection_limit=10: en Transaction mode cada conexión se libera tras cada query,
  //   así que 10 conexiones sirven cientos de requests simultáneos.
  // - pool_timeout=30: tiempo máximo de espera para obtener una conexión libre.
  url.searchParams.set('pgbouncer', 'true');
  url.searchParams.set('connection_limit', '10');
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
    await this.$connect();
    this.logger.log('Database connection pool initialized (Transaction mode)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
