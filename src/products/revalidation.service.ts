import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(private readonly configService: ConfigService) {}

  async revalidate(tags: string[]): Promise<void> {
    const storeUrl = this.configService.get<string>('STORE_URL');
    const secret = this.configService.get<string>('REVALIDATION_SECRET');

    if (!storeUrl || !secret) {
      this.logger.warn('STORE_URL or REVALIDATION_SECRET not set — skipping revalidation');
      return;
    }

    try {
      const res = await fetch(`${storeUrl}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, tags }),
      });

      if (!res.ok) {
        this.logger.warn(`Revalidation failed: ${res.status} ${res.statusText}`);
      } else {
        this.logger.log(`Cache revalidated for tags: ${tags.join(', ')}`);
      }
    } catch (err) {
      this.logger.warn(`Revalidation request error: ${err.message}`);
    }
  }
}
