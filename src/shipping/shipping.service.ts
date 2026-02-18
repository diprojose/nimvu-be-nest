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
    // 1. Try City match
    if (city && state) {
      const cityRate = await this.prisma.shippingRate.findFirst({
        where: { country, state, city },
      });
      if (cityRate) return cityRate;
    }

    // 2. Try State match
    if (state) {
      const stateRate = await this.prisma.shippingRate.findFirst({
        where: { country, state, city: null },
      });
      if (stateRate) return stateRate;
    }

    // 3. Try Country match
    const countryRate = await this.prisma.shippingRate.findFirst({
      where: { country, state: null, city: null },
    });

    if (countryRate) return countryRate;

    // 4. Default or Error?
    // For now, return specific error or null so frontend handles it
    throw new NotFoundException('No shipping rate found for this location');
  }
}
