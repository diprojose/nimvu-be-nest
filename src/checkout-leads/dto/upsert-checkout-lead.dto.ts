import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class LeadItemDto {
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
 * Este endpoint es publico (el cliente todavia no se ha autenticado), asi que
 * el DTO limita longitudes y el servicio ignora cualquier precio que venga del
 * cliente: los resuelve contra la base de datos.
 */
export class UpsertCheckoutLeadDto {
  /** Identificador del navegador. Es la clave del upsert. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sessionId: string;

  @IsEmail({}, { message: 'Correo invalido' })
  @MaxLength(200)
  email: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  name?: string;

  @IsObject()
  @IsOptional()
  shippingAddress?: object;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadItemDto)
  items: LeadItemDto[];
}
