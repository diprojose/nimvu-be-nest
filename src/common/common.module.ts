import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RevalidationService } from './revalidation.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class CommonModule {}
