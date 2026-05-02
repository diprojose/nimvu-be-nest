import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEmail,
  IsEnum,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

class ManualOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number; // Admin define el precio manualmente
}

export class CreateManualOrderDto {
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La orden debe contener al menos un producto.' })
  @ValidateNested({ each: true })
  @Type(() => ManualOrderItemDto)
  items: ManualOrderItemDto[];

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsNumber()
  @IsOptional()
  shippingCost?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
