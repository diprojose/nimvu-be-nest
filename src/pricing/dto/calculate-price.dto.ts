import { IsNumber, Min } from 'class-validator';

/** Lo que Oriana copia del slice de Bambu Studio, mas el trabajo manual. */
export class CalculatePriceDto {
  @IsNumber()
  @Min(0)
  grams: number;

  @IsNumber()
  @Min(0)
  hours: number;

  @IsNumber()
  @Min(0)
  laborMinutes: number;
}
