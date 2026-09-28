import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

/**
 * Marca (o desmarca) la impresión de etiquetas de varias órdenes a la vez.
 *
 * Es un solo endpoint por lote y no un PATCH por orden porque un lote de
 * etiquetas puede traer decenas de órdenes: así queda una escritura en vez de
 * una ráfaga de peticiones que puede quedar a medias.
 */
export class MarkLabelsPrintedDto {
  @IsArray()
  @ArrayNotEmpty()
  // Tope defensivo: una hoja carta lleva 6 etiquetas, así que 200 órdenes ya es
  // un lote enorme. Evita que un bug del cliente sellé la tabla completa.
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  orderIds: string[];

  /** `false` deshace la marca, para cuando la impresión salió mal. */
  @IsBoolean()
  @IsOptional()
  printed?: boolean;
}
