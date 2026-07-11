import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateShippingDto } from './dto/create-shipping.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Umbral (en COP) a partir del cual el envío es gratis.
 * Es la fuente de verdad autoritativa: el backend lo aplica al crear la orden
 * para que el costo de envío no pueda ser manipulado desde el cliente.
 */
export const FREE_SHIPPING_THRESHOLD = 150000;

/** Costo de envío por defecto cuando no hay tarifa configurada para la ubicación. */
export const DEFAULT_SHIPPING_COST = 15000;

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  create(createShippingDto: CreateShippingDto) {
    return this.prisma.shippingRate.create({
      data: {
        ...createShippingDto,
        state: createShippingDto.state || null,
        city: createShippingDto.city || null,
      },
    });
  }

  findAll() {
    return this.prisma.shippingRate.findMany();
  }

  async findOne(id: string) {
    const rate = await this.prisma.shippingRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException(`Shipping rate ${id} not found`);
    return rate;
  }

  update(id: string, updateShippingDto: UpdateShippingDto) {
    const data: any = { ...updateShippingDto };
    if (data.state === '') data.state = null;
    if (data.city === '') data.city = null;

    return this.prisma.shippingRate.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.shippingRate.delete({ where: { id } });
  }

  /**
   * Busca la tarifa de envío más específica para una ubicación
   * (ciudad → departamento → país). Devuelve `null` si no encuentra ninguna.
   */
  async findRate(country: string, state?: string, city?: string) {
    const targetCity = city ? city.trim() : null;
    const targetState = state ? state.trim() : null;

    // 1. Try City match (Exact match on Country + State + City)
    if (targetCity && targetState) {
      const cityRate = await this.prisma.shippingRate.findFirst({
        where: {
          country: { equals: country, mode: 'insensitive' },
          state: { equals: targetState, mode: 'insensitive' },
          city: { equals: targetCity, mode: 'insensitive' },
        },
      });
      if (cityRate) return cityRate;
    }

    // 2. Try State match (City is null OR empty string)
    if (targetState) {
      const stateRate = await this.prisma.shippingRate.findFirst({
        where: {
          country: { equals: country, mode: 'insensitive' },
          state: { equals: targetState, mode: 'insensitive' },
          OR: [{ city: null }, { city: '' }],
        },
      });
      if (stateRate) return stateRate;
    }

    // 3. Try Country match (State & City are null OR empty string)
    const countryRate = await this.prisma.shippingRate.findFirst({
      where: {
        country: { equals: country, mode: 'insensitive' },
        OR: [{ state: null }, { state: '' }],
        AND: {
          OR: [{ city: null }, { city: '' }],
        },
      },
    });

    return countryRate ?? null;
  }

  async calculate(country: string, state?: string, city?: string) {
    const rate = await this.findRate(country, state, city);
    if (rate) return rate;
    throw new NotFoundException('No shipping rate found for this location');
  }

  /**
   * Resuelve el costo de envío autoritativo para una orden.
   * - Si el subtotal alcanza el umbral de envío gratis → 0.
   * - En caso contrario, usa la tarifa configurada para la ubicación,
   *   o el `fallback` provisto (o el costo por defecto) si no hay tarifa.
   *
   * Al recalcularse en el servidor con el subtotal calculado por el backend,
   * el envío gratis no puede ser falseado desde el cliente.
   */
  async resolveShippingCost(params: {
    subtotal: number;
    country?: string;
    state?: string;
    city?: string;
    fallback?: number;
  }): Promise<number> {
    const { subtotal, country = 'Colombia', state, city, fallback } = params;

    if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0;

    const rate = await this.findRate(country, state, city);
    if (rate) return rate.price;

    return fallback ?? DEFAULT_SHIPPING_COST;
  }
}
