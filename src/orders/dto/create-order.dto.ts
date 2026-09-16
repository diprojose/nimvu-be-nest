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
  IsBoolean,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

/**
 * Recorta espacios antes de validar. `@IsNotEmpty()` por si solo acepta una
 * cadena de puros espacios ("   "), que para una ciudad o una direccion es
 * tan inservible como el campo vacio.
 */
const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

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
 * Direccion de envio del cliente.
 *
 * Antes viajaba como `object` sin validar y eso dejo entrar pedidos sin ciudad
 * ni departamento: imposibles de cotizar y de despachar. Los campos que se
 * usan para calcular el envio y armar la guia son obligatorios.
 *
 * El resto se declara aunque no se valide porque el ValidationPipe corre con
 * `whitelist: true`: una propiedad no declarada se elimina del objeto, y el
 * servicio guarda este snapshot completo dentro de la orden.
 */
export class ShippingAddressDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'La direccion de envio es obligatoria.' })
  address_1: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'La ciudad es obligatoria.' })
  city: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El departamento es obligatorio.' })
  province: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El nombre de quien recibe es obligatorio.' })
  first_name: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El telefono de contacto es obligatorio.' })
  phone: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsOptional()
  address_2?: string | null;

  @IsOptional()
  company?: string | null;

  @IsString()
  @IsOptional()
  postal_code?: string;

  @IsString()
  @IsOptional()
  country_code?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsOptional()
  address_name?: string | null;

  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  customer_id?: string;

  @IsBoolean()
  @IsOptional()
  is_default_shipping?: boolean;

  @IsBoolean()
  @IsOptional()
  is_default_billing?: boolean;

  @IsOptional()
  metadata?: unknown;

  @IsOptional()
  created_at?: string;

  @IsOptional()
  updated_at?: string;

  @IsOptional()
  deleted_at?: string | null;

  /** Notas internas que agrega el admin en pedidos manuales. */
  @IsOptional()
  notes?: string;
}

/**
 * El dueno de la orden NO viaja en el body: se toma del JWT en el controller.
 * Si el cliente manda `userId`, el ValidationPipe con whitelist lo descarta.
 */
export class CreateOrderDto {
  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

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
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

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
