import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createCollectionDto: CreateCollectionDto) {
    const { productIds, ...data } = createCollectionDto;
    return this.prisma.collection.create({
      data: {
        ...data,
        products: productIds && productIds.length > 0 ? {
          connect: productIds.map(id => ({ id })),
        } : undefined,
      },
      include: { products: true },
    });
  }

  findAll() {
    return this.prisma.collection.findMany({
      include: { products: true },
    });
  }

  async findOne(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!collection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }
    return collection;
  }

  async findBySlug(slug: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
      include: { products: true },
    });
    if (!collection) {
      throw new NotFoundException(`Collection with slug ${slug} not found`);
    }
    return collection;
  }

  async update(id: string, updateCollectionDto: UpdateCollectionDto) {
    const { productIds, ...data } = updateCollectionDto;
    return this.prisma.collection.update({
      where: { id },
      data: {
        ...data,
        products: productIds ? {
          set: productIds.map(proId => ({ id: proId })),
        } : undefined,
      },
      include: { products: true },
    });
  }

  async remove(id: string) {
    return this.prisma.collection.delete({
      where: { id },
    });
  }
}
