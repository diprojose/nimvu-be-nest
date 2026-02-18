import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateShippingDto } from './dto/create-shipping.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) { }

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

  async calculate(country: string, state?: string, city?: string) {
    const targetCity = city ? city.trim() : null;
    const targetState = state ? state.trim() : null;

    // 1. Try City match (Exact match on Country + State + City)
    if (targetCity && targetState) {
      const cityRate = await this.prisma.shippingRate.findFirst({
        where: {
          country: { equals: country, mode: 'insensitive' },
          state: { equals: targetState, mode: 'insensitive' },
          city: { equals: targetCity, mode: 'insensitive' }
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
          OR: [
            { city: null },
            { city: '' }
          ]
        },
      });
      if (stateRate) return stateRate;
    }

    // 3. Try Country match (State & City are null OR empty string)
    const countryRate = await this.prisma.shippingRate.findFirst({
      where: {
        country: { equals: country, mode: 'insensitive' },
        OR: [
          { state: null },
          { state: '' }
        ],
        AND: {
          OR: [
            { city: null },
            { city: '' }
          ]
        }
      },
    });

    if (countryRate) return countryRate;

    throw new NotFoundException('No shipping rate found for this location');
  }
}
