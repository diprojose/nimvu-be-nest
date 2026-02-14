import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) { }

  create(userId: string, createAddressDto: CreateAddressDto) {
    return this.prisma.address.create({
      data: {
        ...createAddressDto,
        userId,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
    });
  }

  async findOne(id: string, userId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id },
    });
    if (!address || address.userId !== userId) {
      throw new NotFoundException(`Address #${id} not found`);
    }
    return address;
  }

  async update(id: string, userId: string, updateAddressDto: UpdateAddressDto) {
    await this.findOne(id, userId);
    return this.prisma.address.update({
      where: { id },
      data: updateAddressDto,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.address.delete({
      where: { id },
    });
  }
}
