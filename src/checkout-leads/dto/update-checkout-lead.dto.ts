import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CheckoutLeadStatus } from '@prisma/client';

/** Seguimiento comercial del lead. Solo lo usa el admin. */
export class UpdateCheckoutLeadDto {
  @IsEnum(CheckoutLeadStatus)
  @IsOptional()
  status?: CheckoutLeadStatus;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}
