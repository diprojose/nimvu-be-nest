import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL!;
  const url = new URL(base);
  // Transaction mode (puerto 6543) + pgbouncer=true:
  // Las conexiones se liberan tras cada query/transacción y se reutilizan.
  // Con 50 conexiones lógicas en Prisma, Supavisor las multiplexa sobre
  // ~20 conexiones Postgres reales → soporta cientos de usuarios simultáneos.
  url.searchParams.set('connection_limit', '50');
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
