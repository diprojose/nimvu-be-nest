import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidationService } from './revalidation.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: RevalidationService,
  ) {}

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

  async create(createProductDto: CreateProductDto) {
    const { variants, ...productData } = createProductDto;
    const slug = productData.slug || this.slugify(productData.name);

    const product = await this.prisma.product.create({
      data: {
        ...productData,
        slug,
        categoryId: createProductDto.categoryId,
        variants: { create: variants },
      },
      include: { variants: true },
    });

    this.revalidation.revalidate(['products', 'collections']);
    return product;
  }

  findAll(isB2BContext: boolean = false) {
    const where = isB2BContext ? undefined : { isB2BOnly: false };
    return this.prisma.product.findMany({
      where,
      include: { variants: true, category: true },
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
      const currentProduct = await this.prisma.product.findUnique({
        where: { id },
      });
      if (currentProduct && !currentProduct.slug) {
        const nameToSlugify = data.name || currentProduct.name;
        (data as any).slug = this.slugify(nameToSlugify);
      }
    }

    try {
      const updated = await this.prisma.$transaction(async (prisma) => {
        // Update product basic info
        const product = await prisma.product.update({
          where: { id },
          data: data,
        });

        if (variants !== undefined) {
          // Delete variants whose SKU is no longer in the submitted list
          const submittedSkus = variants.map((v) => v.sku);
          await prisma.variant.deleteMany({
            where: { productId: id, sku: { notIn: submittedSkus } },
          });

          // Upsert remaining/new variants
          for (const variant of variants) {
            const { id: variantId, ...variantData } = variant as any;
            if (variantId) {
              await prisma.variant.update({
                where: { id: variantId },
                data: variantData,
              });
            } else {
              await prisma.variant.upsert({
                where: { sku: variantData.sku },
                update: variantData,
                create: { ...variantData, productId: id },
              });
            }
          }
        }

        return product;
      });

      const tags = ['products', 'collections'];
      if (updated.slug) tags.push(`product-${updated.slug}`);
      this.revalidation.revalidate(tags);

      return updated;
    } catch (error) {
      console.error('Error updating product:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async remove(id: string) {
    const product = await this.prisma.product.delete({ where: { id } });
    this.revalidation.revalidate(['products', 'collections']);
    return product;
  }
}
