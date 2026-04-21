import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL!;
  const url = new URL(base);
  url.searchParams.set('pgbouncer', 'true');
  url.searchParams.set('connection_limit', '20');
  url.searchParams.set('pool_timeout', '20');
  url.searchParams.set('connect_timeout', '15');
  return url.toString();
}

const RETRYABLE_CODES = new Set(['P1001', 'P1017', 'P2024']);
const MAX_RETRIES = 3;

async function retryOperation<T>(fn: () => Promise<T>, logger: Logger): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        RETRYABLE_CODES.has(err.code);

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = 150 * attempt;
        logger.warn(`${(err as Prisma.PrismaClientKnownRequestError).code} on attempt ${attempt}/${MAX_RETRIES} — retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Unreachable');
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({
      datasources: {
        db: { url: buildDatabaseUrl() },
      },
    });
    this.logger.log('PrismaService initialized (lazy connect, Transaction mode, auto-retry on P1001/P1017/P2024)');
  }

  async onModuleInit() {
    await this.$connect();
    // Ping DB every 4 minutes to keep Supavisor connections alive
    this.keepAliveInterval = setInterval(async () => {
      try {
        await this.$queryRawUnsafe('SELECT 1');
      } catch (err) {
        this.logger.warn('Keep-alive ping failed, connection will reconnect on next request');
      }
    }, 4 * 60 * 1000);
    this.logger.log('Database connected, keep-alive started (4 min interval)');
  }

  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return retryOperation(fn, this.logger);
  }

  async onModuleDestroy() {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    await this.$disconnect();
  }
}
