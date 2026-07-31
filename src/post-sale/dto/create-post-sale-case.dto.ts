import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PostSaleFault,
  PostSaleShippingPayer,
  PostSaleStatus,
  PostSaleType,
  ShippingCarrier,
} from '@prisma/client';

export class PostSaleItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  /** Variante enviada como repuesto, o variante destino en un cambio. */
  @IsString()
  @IsOptional()
  variantName?: string;

  /** Solo en cambios: la variante que el cliente tenia originalmente. */
  @IsString()
  @IsOptional()
  fromVariantName?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreatePostSaleCaseDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsEnum(PostSaleType)
  type: PostSaleType;

  @IsEnum(PostSaleFault)
  @IsOptional()
  fault?: PostSaleFault;

  @IsEnum(PostSaleStatus)
  @IsOptional()
  status?: PostSaleStatus;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PostSaleShippingPayer)
  @IsOptional()
  shippingPayer?: PostSaleShippingPayer;

  @IsNumber()
  @Min(0)
  @IsOptional()
  shippingAmount?: number;

  @IsEnum(ShippingCarrier)
  @IsOptional()
  shippingCarrier?: ShippingCarrier;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostSaleItemDto)
  @IsOptional()
  items?: PostSaleItemDto[];
}
