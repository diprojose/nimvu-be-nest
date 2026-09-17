import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MailModule } from '../mail/mail.module';
import { ShippingModule } from '../shipping/shipping.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [MailModule, ShippingModule, DiscountsModule, ReviewsModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
