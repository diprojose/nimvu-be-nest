import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBannerDto {
  @IsString()
  @IsOptional()
  universeId?: string;

  @IsString()
  @IsNotEmpty()
  image: string;

  @IsString()
  @IsOptional()
  mobileImage?: string;

  @IsString()
  @IsOptional()
  badge?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsString()
  @IsOptional()
  ctaText?: string;

  @IsString()
  @IsOptional()
  ctaHref?: string;

  @IsString()
  @IsOptional()
  textColor?: string;

  @IsString()
  @IsOptional()
  badgeColor?: string;

  @IsString()
  @IsOptional()
  titleColor?: string;

  @IsString()
  @IsOptional()
  subtitleColor?: string;

  @IsString()
  @IsOptional()
  accentLineColor?: string;

  @IsString()
  @IsOptional()
  ctaBgColor?: string;

  @IsString()
  @IsOptional()
  ctaTextColor?: string;

  @IsInt()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
