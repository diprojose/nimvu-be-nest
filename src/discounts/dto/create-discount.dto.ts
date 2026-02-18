import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsDateString, IsUUID, IsArray, IsNotEmpty } from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateDiscountDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  code?: string; // Optional: If provided, it's a Coupon. If null, it's a Campaign.

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  value: number;

  @IsDateString()
  startDate: string; // ISO Date String

  @IsDateString()
  endDate: string; // ISO Date String

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  usageLimit?: number;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  productIds?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  collectionIds?: string[];
}
