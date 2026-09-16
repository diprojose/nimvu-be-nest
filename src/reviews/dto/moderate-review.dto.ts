import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ReviewStatus } from '@prisma/client';

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Accion de moderacion del admin sobre una resena. */
export class ModerateReviewDto {
  @IsEnum(ReviewStatus)
  @IsOptional()
  status?: ReviewStatus;

  /** Respuesta publica de Nimvu. Cadena vacia borra la respuesta. */
  @Trim()
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  adminReply?: string;
}
