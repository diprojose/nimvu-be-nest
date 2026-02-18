import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DiscountType } from '@prisma/client';

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createDiscountDto: CreateDiscountDto) {
    const { productIds, collectionIds, ...data } = createDiscountDto;

    try {
      const discount = await this.prisma.discount.create({
        data: {
          ...data,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          products: productIds?.length ? { connect: productIds.map(id => ({ id })) } : undefined,
          collections: collectionIds?.length ? { connect: collectionIds.map(id => ({ id })) } : undefined,
        },
        include: { products: true, collections: true },
      });

      // If it's a campaign (no code) and active, apply it immediately
      if (!discount.code && discount.isActive) {
        await this.applyDiscountToProducts(discount.id);
      }

      return discount;
    } catch (error) {
      console.error('Error creating discount:', error);
      if (error.code === 'P2002') {
        throw new Error('Discount code already exists');
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.discount.findMany({
      include: { products: true, collections: true },
    });
  }

  async findOne(id: string) {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: { products: true, collections: { include: { products: true } } },
    });
    if (!discount) throw new NotFoundException(`Discount ${id} not found`);
    return discount;
  }

  async update(id: string, updateDiscountDto: UpdateDiscountDto) {
    const { productIds, collectionIds, ...data } = updateDiscountDto;

    try {
      const discount = await this.prisma.discount.update({
        where: { id },
        data: {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          products: productIds ? { set: productIds.map(id => ({ id })) } : undefined,
          collections: collectionIds ? { set: collectionIds.map(id => ({ id })) } : undefined,
        },
        include: { products: true, collections: true },
      });

      // Re-apply or remove based on status
      if (!discount.code) {
        if (discount.isActive) {
          await this.applyDiscountToProducts(discount.id);
        } else {
          await this.removeDiscountFromProducts(discount.id);
        }
      }

      return discount;
    } catch (error) {
      console.error('Error updating discount:', error);
      if (error.code === 'P2002') {
        throw new Error('Discount code already exists');
      }
      throw error;
    }
  }

  async remove(id: string) {
    // Before deleting, ensure products are cleared if it was active
    await this.removeDiscountFromProducts(id);
    return this.prisma.discount.delete({ where: { id } });
  }

  // --- Helper Methods ---

  private async applyDiscountToProducts(discountId: string) {
    const discount = await this.findOne(discountId);
    if (!discount) return;

    // 1. Get all involved products
    // Direct products
    let targets = [...discount.products];

    // Collection products
    for (const collection of discount.collections) {
      const col = await this.prisma.collection.findUnique({
        where: { id: collection.id },
        include: { products: true }
      });
      if (col && col.products) {
        targets = [...targets, ...col.products];
      }
    }

    // Deduplicate
    const uniqueProductIds = [...new Set(targets.map(p => p.id))];

    // 2. Update each product
    for (const productId of uniqueProductIds) {
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) continue;

      let newPrice = product.price;
      if (discount.type === DiscountType.FIXED) {
        newPrice = Math.max(0, product.price - discount.value);
      } else {
        newPrice = product.price * (1 - discount.value / 100);
      }

      await this.prisma.product.update({
        where: { id: productId },
        data: { discountPrice: newPrice },
      });
    }
  }

  private async removeDiscountFromProducts(discountId: string) {
    // Logic similar to apply, but setting discountPrice to null
    // Ideally we should check if OTHER discounts apply, but for now we clear it.
    const discount = await this.findOne(discountId);
    if (!discount) return;

    let targets = [...discount.products];
    for (const collection of discount.collections) {
      const col = await this.prisma.collection.findUnique({
        where: { id: collection.id },
        include: { products: true }
      });
      if (col && col.products) {
        targets = [...targets, ...col.products];
      }
    }

    const uniqueProductIds = [...new Set(targets.map(p => p.id))];

    for (const productId of uniqueProductIds) {
      await this.prisma.product.update({
        where: { id: productId },
        data: { discountPrice: null },
      });
    }
  }
}
