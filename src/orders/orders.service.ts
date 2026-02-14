import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createOrderDto: CreateOrderDto) {
    const { userId, items, paymentId, shippingAddress } = createOrderDto;

    // 1. Validate User exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 2. Transaction: Validate Stock -> Calculate Total -> Create Order -> Decrement Stock
    return this.prisma.$transaction(async (tx) => {
      let total = 0;
      const orderItemsData: { productId: string; quantity: number; price: number; variantId?: string }[] = [];
      // 2. Validate Items & Calculate Total
      for (const item of createOrderDto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { variants: true },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${item.productId} not found`);
        }

        let price = product.price;

        // Handle Variant Logic
        if (item.variantId) {
          const variant = product.variants.find(v => v.id === item.variantId);
          if (!variant) {
            throw new NotFoundException(`Variant with ID ${item.variantId} not found for product ${product.name}`);
          }
          if (variant.stock < item.quantity) {
            throw new BadRequestException(`Insufficient stock for variant ${variant.name} of product ${product.name}`);
          }
          if (variant.price) {
            price = variant.price;
          }

          // Decrement Variant Stock
          await tx.variant.update({
            where: { id: variant.id },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          // Handle Base Product Logic
          if (product.stock < item.quantity) {
            throw new BadRequestException(`Insufficient stock for product ${product.name}`);
          }
          // Decrement Product Stock
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: item.quantity } },
          });
        }

        total += price * item.quantity;
        orderItemsData.push({
          productId: item.productId,
          variantId: item.variantId, // Add variantId to order item
          quantity: item.quantity,
          price: price,
        });
      }

      // Create Order
      return tx.order.create({
        data: {
          userId,
          total,
          paymentId,
          shippingAddress, // Save validated address snapshot
          items: {
            create: orderItemsData,
          },
        },
        include: { items: true },
      });
    });
  }

  findAll(userId?: string) {
    const where = userId ? { userId } : {};
    return this.prisma.order.findMany({
      where,
      include: { items: { include: { product: true } }, user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, user: { select: { id: true, email: true, name: true } } },
    });
  }

  update(id: string, updateOrderDto: UpdateOrderDto) {
    return this.prisma.order.update({
      where: { id },
      data: updateOrderDto,
    });
  }

  remove(id: string) {
    return this.prisma.order.delete({
      where: { id },
    });
  }
}
