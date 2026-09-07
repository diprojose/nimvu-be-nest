import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { UpdatePricingSettingsDto } from './dto/update-pricing-settings.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { AdminOnly } from '../auth/admin-only.decorator';

/**
 * Solo admin: son los costos internos del negocio y el margen. Nada de esto
 * puede quedar expuesto a la tienda.
 */
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @AdminOnly()
  @Get('settings')
  getSettings() {
    return this.pricingService.getSettings();
  }

  @AdminOnly()
  @Patch('settings')
  updateSettings(@Body() dto: UpdatePricingSettingsDto) {
    return this.pricingService.updateSettings(dto);
  }

  // POST y no GET porque son varios numeros de entrada y se lee mejor en el
  // cuerpo; no cambia nada en la base.
  @AdminOnly()
  @Post('calculate')
  calculate(@Body() dto: CalculatePriceDto) {
    return this.pricingService.calculate(dto);
  }
}
