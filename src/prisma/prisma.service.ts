import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL!;
  const url = new URL(base);
  url.searchParams.set('pgbouncer', 'true');
  url.searchParams.set('connection_limit', '10');
  url.searchParams.set('pool_timeout', '30');
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
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: { url: buildDatabaseUrl() },
      },
    });
    this.logger.log('PrismaService initialized (lazy connect, Transaction mode, auto-retry on P1001/P1017/P2024)');
  }

  /**
   * Wraps any Prisma call with automatic retry for transient connection errors.
   * Use for critical operations where you want explicit control.
   */
  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return retryOperation(fn, this.logger);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
