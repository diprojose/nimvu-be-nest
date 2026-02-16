import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateProductDto, CreateVariantDto } from './create-product.dto';

class UpdateVariantDto extends PartialType(CreateVariantDto) {
  @IsString()
  @IsOptional()
  id?: string;
}

export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['variants'] as const)) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateVariantDto)
  @IsOptional()
  variants?: UpdateVariantDto[];
}
