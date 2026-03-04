import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { BulkB2BPricesDto } from './dto/bulk-b2b-prices.dto';
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
      include: { variants: true, category: true, b2bPrices: true },
    });
  }

  findOne(term: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        term,
      );
    const where = isUuid ? { id: term } : { slug: term };

    return this.prisma.product.findUnique({
      where,
      include: { variants: true, category: true, b2bPrices: true },
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
      const currentProduct = await this.prisma.product.findUnique({
        where: { id },
      });
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
                  ...(variantData as any),
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
  async updateB2BPricesBulk(bulkDto: BulkB2BPricesDto) {
    try {
      return await this.prisma.$transaction(async (prisma) => {
        let updatedCount = 0;

        for (const item of bulkDto.prices) {
          // Check if product exists first to avoid foreign key errors
          const product = await prisma.product.findUnique({
            where: { id: item.productId }
          });

          if (!product) continue;

          // Clear existing prices for this product to prevent stale data
          await prisma.b2BPrice.deleteMany({
            where: { productId: item.productId }
          });

          // Create new ones based on the valid payload
          const b2bPricesToCreate: { productId: string; minQuantity: number; price: number; isActive: boolean; }[] = [];
          if (item.price12 && item.price12 > 0) {
            b2bPricesToCreate.push({ productId: item.productId, minQuantity: 12, price: item.price12, isActive: item.isActive });
          }
          if (item.price50 && item.price50 > 0) {
            b2bPricesToCreate.push({ productId: item.productId, minQuantity: 50, price: item.price50, isActive: item.isActive });
          }
          if (item.price100 && item.price100 > 0) {
            b2bPricesToCreate.push({ productId: item.productId, minQuantity: 100, price: item.price100, isActive: item.isActive });
          }

          if (b2bPricesToCreate.length > 0) {
            await prisma.b2BPrice.createMany({
              data: b2bPricesToCreate
            });
            updatedCount++;
          }
        }

        return { success: true, message: `Updated B2B prices for ${updatedCount} products.` };
      });
    } catch (error) {
      console.error('Error updating bulk B2B prices:', error);
      throw new InternalServerErrorException('Failed to process bulk upload.');
    }
  }

  remove(id: string) {
    return this.prisma.product.delete({
      where: { id },
    });
  }
}
