import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Todo es opcional para poder guardar un solo campo desde la pantalla sin
 * reenviar el resto. Los limites no son decorativos: un margen de 1 haria una
 * division por cero y una vida util de 0 horas dispararia la depreciacion al
 * infinito.
 */
export class UpdatePricingSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  filamentPricePerKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.9)
  wastePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  printerWatts?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  energyPricePerKwh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  printerCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  printerLifeHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laborPricePerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packagingCost?: number;

  // Tope en 0.95: mas alto el precio se dispara y deja de ser un precio real.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.95)
  targetMargin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.5)
  paymentFeePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  roundingStep?: number;
}
