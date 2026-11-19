import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Dirección corregida después de la compra. Solo trae los campos que el admin
 * puede tocar; los que no vienen se conservan, y el costo de envío, el cupón y
 * el descuento que viven en el mismo JSON nunca se reemplazan desde aquí.
 */
export class EditShippingAddressDto {
  @IsString() @IsOptional() @MaxLength(80) first_name?: string;
  @IsString() @IsOptional() @MaxLength(80) last_name?: string;
  @IsString() @IsOptional() @MaxLength(30) phone?: string;
  @IsString() @IsOptional() @MaxLength(200) address_1?: string;
  @IsString() @IsOptional() @MaxLength(200) address_2?: string;
  @IsString() @IsOptional() @MaxLength(80) city?: string;
  @IsString() @IsOptional() @MaxLength(80) province?: string;
  @IsString() @IsOptional() @MaxLength(500) notes?: string;
}

export class EditOrderItemDto {
  @IsUUID()
  id: string;

  /** Otra variante del mismo producto (p. ej. otro color). `null` no se
   *  acepta: una línea con variante no puede quedar sin ella. */
  @IsUUID()
  @IsOptional()
  variantId?: string;

  /** Color o detalle acordado con el cliente. Cadena vacía = borrar la nota. */
  @IsString()
  @IsOptional()
  @MaxLength(200)
  note?: string;
}

export class EditOrderDetailsDto {
  @ValidateNested()
  @Type(() => EditShippingAddressDto)
  @IsOptional()
  shippingAddress?: EditShippingAddressDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditOrderItemDto)
  @IsOptional()
  items?: EditOrderItemDto[];
}
