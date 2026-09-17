import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewTokenService } from './review-token.service';

@Module({
  // ReviewTokenService lee JWT_SECRET y STORE_URL del ConfigService.
  imports: [ConfigModule],
  providers: [ReviewsService, ReviewTokenService],
  controllers: [ReviewsController],
  // Lo usa OrdersService para armar los enlaces del correo post-entrega.
  exports: [ReviewTokenService],
})
export class ReviewsModule {}
