import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MailModule } from '../mail/mail.module';
import { ShippingModule } from '../shipping/shipping.module';

@Module({
  imports: [MailModule, ShippingModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
