import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Recorta espacios antes de validar: `@IsNotEmpty()` por si solo acepta una
 * cadena de puros espacios, que como comentario no dice nada.
 */
const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/**
 * El autor NO viaja en el body: se toma del JWT en el controller, igual que el
 * dueno de una orden. Si el cliente manda `userId`, el ValidationPipe con
 * whitelist lo descarta.
 */
export class CreateReviewDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsInt({ message: 'La calificacion debe ser un numero entero.' })
  @Min(1, { message: 'La calificacion minima es 1 estrella.' })
  @Max(5, { message: 'La calificacion maxima es 5 estrellas.' })
  rating: number;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Escribe un comentario sobre el producto.' })
  @MaxLength(2000, { message: 'El comentario no puede pasar de 2000 caracteres.' })
  comment: string;
}
