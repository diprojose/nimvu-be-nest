import { ConflictException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
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

  findAll(isB2BContext: boolean = false, includeInactive: boolean = false) {
    const where: any = {};
    if (!isB2BContext) where.isB2BOnly = false;
    if (!includeInactive) where.isActive = true;
    return this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { variants: true, category: true },
    });
  }

  async findOne(term: string, includeInactive: boolean = false) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        term,
      );
    const where = isUuid ? { id: term } : { slug: term };

    const product = await this.prisma.product.findUnique({
      where,
      include: { variants: true, category: true },
    });

    if (!product) return null;
    if (!includeInactive && product.isActive === false) return null;
    return product;
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
          const submittedSkus = variants.map((v) => v.sku).filter((s): s is string => !!s);
          await prisma.variant.deleteMany({
            where: { productId: id, sku: { notIn: submittedSkus } },
          });

          // Update existing variants by ID, create new ones
          for (const variant of variants) {
            const { id: variantId, ...variantData } = variant as any;
            if (variantId) {
              await prisma.variant.update({
                where: { id: variantId },
                data: variantData,
              });
            } else {
              // Variant without id: could be a brand new variant, OR an existing
              // variant that the frontend re-sent without its id. Lookup by sku
              // to avoid P2002 unique-constraint failures.
              const existing = variantData.sku
                ? await prisma.variant.findUnique({ where: { sku: variantData.sku } })
                : null;
              if (existing && existing.productId === id) {
                await prisma.variant.update({
                  where: { id: existing.id },
                  data: variantData,
                });
              } else if (existing) {
                throw new ConflictException(
                  `El SKU "${variantData.sku}" ya está en uso por otro producto.`,
                );
              } else {
                await prisma.variant.create({
                  data: { ...variantData, productId: id },
                });
              }
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
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(error instanceof Error ? error.message : String(error));
    }
  }

  async remove(id: string) {
    const product = await this.prisma.product.delete({ where: { id } });
    this.revalidation.revalidate(['products', 'collections']);
    return product;
  }
}
