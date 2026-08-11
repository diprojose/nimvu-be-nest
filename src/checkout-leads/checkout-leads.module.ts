import { Module } from '@nestjs/common';
import { CheckoutLeadsService } from './checkout-leads.service';
import { CheckoutLeadsController } from './checkout-leads.controller';

@Module({
  providers: [CheckoutLeadsService],
  controllers: [CheckoutLeadsController],
})
export class CheckoutLeadsModule {}
