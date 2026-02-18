import { IsString, IsOptional, IsNumber, IsNotEmpty, Min } from 'class-validator';

export class CreateShippingDto {
  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsNumber()
  @Min(0)
  price: number;
}
