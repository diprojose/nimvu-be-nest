import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class B2BPriceDto {
  @IsString()
  productId: string;

  @IsNumber()
  @IsOptional()
  price12?: number;

  @IsNumber()
  @IsOptional()
  price50?: number;

  @IsNumber()
  @IsOptional()
  price200?: number;

  @IsBoolean()
  isActive: boolean;
}

export class BulkB2BPricesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => B2BPriceDto)
  prices: B2BPriceDto[];
}
