import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) { }

  create(createProductDto: CreateProductDto) {
    const { variants, ...productData } = createProductDto;
    return this.prisma.product.create({
      data: {
        ...productData,
        categoryId: createProductDto.categoryId, // Save categoryId
        variants: {
          create: variants,
        },
      },
      include: { variants: true },
    });
  }

  findAll() {
    return this.prisma.product.findMany({
      include: { variants: true, category: true },
    });
  }

  findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { variants: true, category: true },
    });
  }

  update(id: string, updateProductDto: UpdateProductDto) {
    // Basic update for product fields. Variant management should ideally have its own endpoints or complex logic.
    // For now, we allow updating product fields.
    const { variants, ...data } = updateProductDto;
    return this.prisma.product.update({
      where: { id },
      data: data,
    });
  }

  remove(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }
}
