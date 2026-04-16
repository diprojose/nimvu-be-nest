import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

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

  /**
   * Ejecuta una operación con reintentos automáticos para errores transitorios:
   * - P1017: Supabase cerró la conexión idle (común en dev con poca actividad)
   * - P2024: Pool de conexiones agotado bajo carga
   */
  async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T | undefined> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const isRetryable =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          (err.code === 'P1017' || err.code === 'P2024');

        if (isRetryable && attempt < retries) {
          this.logger.warn(`${(err as Prisma.PrismaClientKnownRequestError).code} — retrying (${attempt}/${retries})...`);
          await new Promise((r) => setTimeout(r, 100 * attempt));
        } else {
          throw err;
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
