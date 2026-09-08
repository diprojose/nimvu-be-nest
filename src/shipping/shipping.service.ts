import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateShippingDto } from './dto/create-shipping.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { ShippingRate } from '@prisma/client';

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
   * Precedencia ciudad → departamento → país sobre una lista de tarifas ya
   * cargada. Es la unica definicion de esa precedencia: tanto la busqueda
   * suelta como el resolvedor por lotes pasan por aqui, para que no puedan
   * separarse con el tiempo.
   */
  private pickRate(
    rates: ShippingRate[],
    country: string,
    state?: string,
    city?: string,
  ): ShippingRate | null {
    const targetCity = city ? city.trim() : null;
    const targetState = state ? state.trim() : null;

    const eq = (value: string | null, target: string | null) =>
      (value ?? '').toLowerCase() === (target ?? '').toLowerCase();
    const blank = (value: string | null) => value === null || value === '';

    const sameCountry = (r: ShippingRate) => eq(r.country, country);

    // 1. Ciudad exacta (pais + departamento + ciudad).
    if (targetCity && targetState) {
      const cityRate = rates.find(
        (r) =>
          sameCountry(r) && eq(r.state, targetState) && eq(r.city, targetCity),
      );
      if (cityRate) return cityRate;
    }

    // 2. Departamento (ciudad vacia).
    if (targetState) {
      const stateRate = rates.find(
        (r) => sameCountry(r) && eq(r.state, targetState) && blank(r.city),
      );
      if (stateRate) return stateRate;
    }

    // 3. Pais (departamento y ciudad vacios).
    return (
      rates.find(
        (r) => sameCountry(r) && blank(r.state) && blank(r.city),
      ) ?? null
    );
  }

  /**
   * Resolvedor que carga las tarifas UNA sola vez y despues resuelve en
   * memoria.
   *
   * Existe para listas: costear el envio de N filas llamando findRate por cada
   * una disparaba hasta 3 consultas por fila. Con 18 zonas distintas en la
   * lista de carritos abandonados eran ~54 idas y vueltas a la base, y el
   * endpoint tardaba mas de 7 segundos. Las tarifas son un punado de filas, asi
   * que traerlas todas de una sale mucho mas barato que buscarlas una por una.
   */
  async createRateResolver() {
    const rates = await this.prisma.shippingRate.findMany();
    return (country: string, state?: string, city?: string) =>
      this.pickRate(rates, country, state, city);
  }

  /**
   * Busca la tarifa de envío más específica para una ubicación
   * (ciudad → departamento → país). Devuelve `null` si no encuentra ninguna.
   */
  async findRate(country: string, state?: string, city?: string) {
    const rates = await this.prisma.shippingRate.findMany();
    return this.pickRate(rates, country, state, city);
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
