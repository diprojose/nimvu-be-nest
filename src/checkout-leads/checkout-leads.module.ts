import { Module } from '@nestjs/common';
import { CheckoutLeadsService } from './checkout-leads.service';
import { CheckoutLeadsController } from './checkout-leads.controller';
import { ShippingModule } from '../shipping/shipping.module';

@Module({
  imports: [ShippingModule],
  providers: [CheckoutLeadsService],
  controllers: [CheckoutLeadsController],
})
export class CheckoutLeadsModule {}
