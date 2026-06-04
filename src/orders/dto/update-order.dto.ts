import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus, ShippingCarrier } from '@prisma/client';

export class UpdateOrderDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsString()
  @IsOptional()
  paymentId?: string;

  @IsEnum(ShippingCarrier)
  @IsOptional()
  shippingCarrier?: ShippingCarrier | null;

  @IsString()
  @IsOptional()
  trackingNumber?: string | null;
}
