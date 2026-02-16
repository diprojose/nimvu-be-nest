import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) { }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .normalize('NFD') // Normalizing to NFD Form
      .replace(/[\u0300-\u036f]/g, ''); // Removes diacritical marks
  }

  create(createProductDto: CreateProductDto) {
    const { variants, ...productData } = createProductDto;
    const slug = productData.slug || this.slugify(productData.name);

    return this.prisma.product.create({
      data: {
        ...productData,
        slug,
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

  findOne(term: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);
    const where = isUuid ? { id: term } : { slug: term };

    return this.prisma.product.findUnique({
      where,
      include: { variants: true, category: true },
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    // Basic update for product fields. Variant management should ideally have its own endpoints or complex logic.
    // For now, we allow updating product fields.
    const { variants, ...data } = updateProductDto;

    // Handle empty string for categoryId which might come from the frontend
    if (data.categoryId === '') {
      (data as any).categoryId = null;
    }

    // Auto-generate slug if missing in DB and not provided in update
    if (!data.slug) {
      const currentProduct = await this.prisma.product.findUnique({ where: { id } });
      if (currentProduct && !currentProduct.slug) {
        const nameToSlugify = data.name || currentProduct.name;
        (data as any).slug = this.slugify(nameToSlugify);
      }
    }

    try {
      return await this.prisma.$transaction(async (prisma) => {
        // Update product basic info
        const product = await prisma.product.update({
          where: { id },
          data: data,
        });

        // Handle variants if provided
        if (variants && variants.length > 0) {
          for (const variant of variants) {
            const { id: variantId, ...variantData } = variant;
            if (variantId) {
              // Update existing variant by ID
              await prisma.variant.update({
                where: { id: variantId },
                data: variantData,
              });
            } else {
              // Upsert by SKU: Update if exists, Create if not
              // This handles cases where the frontend sends an existing variant without ID
              await prisma.variant.upsert({
                where: { sku: variantData.sku },
                update: variantData,
                create: {
                  ...variantData as any,
                  productId: id,
                },
              });
            }
          }
        }
        return product;
      });
    } catch (error) {
      console.error('Error updating product:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  remove(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }
}
