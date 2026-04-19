import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, catchError, throwError, timer, retry } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { Prisma } from '@prisma/client';

const RETRYABLE_CODES = new Set(['P1001', 'P1017', 'P2024']);
const MAX_RETRIES = 2;

@Injectable()
export class PrismaRetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PrismaRetryInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        const isRetryable =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          RETRYABLE_CODES.has(err.code);

        if (!isRetryable) {
          return throwError(() => err);
        }

        this.logger.warn(
          `${err.code} caught — retrying request (${context.getClass().name}.${context.getHandler().name})`,
        );

        // Retry the handler with exponential backoff
        let attempt = 0;
        return next.handle().pipe(
          retry({
            count: MAX_RETRIES,
            delay: (error) => {
              const isRetryableInner =
                error instanceof Prisma.PrismaClientKnownRequestError &&
                RETRYABLE_CODES.has(error.code);

              if (!isRetryableInner) {
                throw error;
              }

              attempt++;
              const delay = 200 * attempt;
              this.logger.warn(
                `${error.code} retry ${attempt}/${MAX_RETRIES} in ${delay}ms — ${context.getClass().name}.${context.getHandler().name}`,
              );
              return timer(delay);
            },
          }),
        );
      }),
    );
  }
}
