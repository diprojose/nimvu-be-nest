import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/**
 * Resena creada desde el enlace del correo post-entrega. No lleva productId:
 * va dentro del token firmado, para que nadie pueda apuntar su resena a otro
 * producto cambiando el body.
 */
export class CreateReviewByTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

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
