import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePricingSettingsDto } from './dto/update-pricing-settings.dto';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { calculatePrice, type PricingParams } from './pricing.calculator';
import { FREE_SHIPPING_THRESHOLD } from '../shipping/shipping.service';

/** Fila unica: el negocio tiene un solo juego de costos vigente. */
const SETTINGS_ID = 'default';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Los parametros, creandolos con los valores por defecto del esquema la
   * primera vez. Se hace con upsert y no con un seed aparte para que la
   * pantalla funcione en un ambiente recien levantado sin pasos manuales.
   */
  async getSettings() {
    return this.prisma.pricingSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    });
  }

  async updateSettings(dto: UpdatePricingSettingsDto) {
    return this.prisma.pricingSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...dto },
      update: dto,
    });
  }

  /**
   * Costea una pieza con los parametros guardados.
   *
   * El calculo vive en el backend y no en la pantalla a proposito: es la unica
   * logica de plata del proyecto, aqui queda cubierta por pruebas y en un solo
   * lugar, listo para reusarla cuando se guarde el costeo de cada producto.
   */
  async calculate(dto: CalculatePriceDto) {
    const settings = await this.getSettings();

    // El envio mas caro configurado. Se usa solo para avisar cuanto margen se
    // come el envio gratis cuando el producto por si solo pasa el umbral.
    const costliest = await this.prisma.shippingRate.findFirst({
      orderBy: { price: 'desc' },
      select: { price: true },
    });

    const breakdown = calculatePrice(dto, settings as PricingParams, {
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      maxShippingCost: costliest?.price ?? 0,
    });

    return { settings, breakdown };
  }
}
