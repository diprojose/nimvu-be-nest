import {
  IsArray,
  IsNotEmpty,
  ValidateNested,
  IsInt,
  Min,
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

/**
 * El dueno de la orden NO viaja en el body: se toma del JWT en el controller.
 * Si el cliente manda `userId`, el ValidationPipe con whitelist lo descarta.
 */
export class CreateOrderDto {
  @IsObject()
  @IsNotEmpty()
  shippingAddress: object; // Accepts the address object

  @IsArray()
  @ArrayMinSize(1, { message: 'La orden debe contener al menos un producto.' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  @IsOptional()
  paymentId?: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsNumber()
  @IsOptional()
  shippingCost?: number;

  /** Cupón que el cliente aplicó. El servidor lo revalida y calcula el monto. */
  @IsString()
  @IsOptional()
  couponCode?: string;
}

export class CreateGuestOrderDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsObject()
  @IsNotEmpty()
  shippingAddress: object; // Accepts the address object

  @IsArray()
  @ArrayMinSize(1, { message: 'La orden debe contener al menos un producto.' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  @IsOptional()
  paymentId?: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsNumber()
  @IsOptional()
  shippingCost?: number;

  /** Cupón que el cliente aplicó. El servidor lo revalida y calcula el monto. */
  @IsString()
  @IsOptional()
  couponCode?: string;
}
