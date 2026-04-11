import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CreateOrderDto, CreateGuestOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) { }

  async createGuestOrder(createGuestOrderDto: CreateGuestOrderDto) {
    const { email, items, paymentId, paymentMethod, shippingAddress, shippingCost } = createGuestOrderDto;

    // Verificar si el usuario ya existe
    let user = await this.prisma.user.findUnique({ where: { email } });
    let isNewUser = false;
    let generatedPassword = '';

    if (!user) {
      // Si no existe, crear usuario
      isNewUser = true;
      generatedPassword = Math.random().toString(36).slice(-8); // simple 8 char password
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);
      
      const addr = shippingAddress as any;
      const nameFromAddress = addr.first_name ? `${addr.first_name} ${addr.last_name || ''}`.trim() : 'Invitado';

      user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: nameFromAddress,
          role: 'USER',
          addresses: {
            create: [
              {
                street: addr.address_1 || '',
                city: addr.city || '',
                state: addr.province || '',
                zip: addr.postal_code || '',
                country: 'Colombia',
                phone: addr.phone || '',
              }
            ]
          }
        }
      });
    }

    // Delegation to standard order creation using the existing method context,
    // avoiding code duplication of the large logic block.
    const createOrderDto: CreateOrderDto = {
      userId: user.id,
      items,
      paymentId,
      paymentMethod,
      shippingAddress,
      shippingCost,
    };

    const order = await this.create(createOrderDto);

    // Send emails: the standard create method already sends order confirmation and admin alert.
    // If it's a new user, we also send the guest welcome email.
    if (isNewUser) {
      this.mailService.sendGuestWelcome(user, generatedPassword);
    }

    return order;
  }

  async create(createOrderDto: CreateOrderDto) {
    const { userId, items, paymentId, paymentMethod, shippingAddress, shippingCost } =
      createOrderDto;

    // 1. Validate User exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 2. Transaction: Validate Stock -> Calculate Total -> Create Order -> Decrement Stock
    const order = await this.prisma.$transaction(async (tx) => {
      let total = 0;
      const orderItemsData: {
        productId: string;
        quantity: number;
        price: number;
        variantId?: string;
      }[] = [];
      // 2. Validate Items & Calculate Total
      for (const item of createOrderDto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { variants: true },
        });

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${item.productId} not found`,
          );
        }

        let price = product.price;

        // Handle Variant Logic
        if (item.variantId) {
          const variant = product.variants.find((v) => v.id === item.variantId);
          if (!variant) {
            throw new NotFoundException(
              `Variant with ID ${item.variantId} not found for product ${product.name}`,
            );
          }
          if (variant.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for variant ${variant.name} of product ${product.name}`,
            );
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
            throw new BadRequestException(
              `Insufficient stock for product ${product.name}`,
            );
          }
          // Decrement Product Stock
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: item.quantity } },
          });
        }

        // --- B2B vs Normal User Price Logic ---
        const isB2B = user.role === 'B2B' && user.isB2BApproved;

        if (isB2B) {
          // B2B Global Percentage Logic
          if (item.quantity >= 200) {
            price = price * 0.75; // 25% discount
          } else if (item.quantity >= 50) {
            price = price * 0.80; // 20% discount
          } else if (item.quantity >= 12) {
            price = price * 0.90; // 10% discount
          }
        } else {
          // Normal users logic - respects standard discounts if no variant override
          // Or applies product discountPrice if it exists and is valid
          const now = new Date();
          if (
            product.discountPrice &&
            product.discountEndDate &&
            now <= product.discountEndDate &&
            !item.variantId // Typically discounts apply to base products, unless variant has one
          ) {
            price = product.discountPrice;
          }
        }

        total += price * item.quantity;
        orderItemsData.push({
          productId: item.productId,
          variantId: item.variantId, // Add variantId to order item
          quantity: item.quantity,
          price: price,
        });
      }

      const finalTotal = total + (shippingCost || 0);
      const addressWithShipping = {
        ...(shippingAddress as any),
        shippingCost: shippingCost || 0,
      };

      // Create Order
      return tx.order.create({
        data: {
          userId,
          total: finalTotal,
          paymentId,
          paymentMethod, // Inherited newly parsed tracking prop
          shippingAddress: addressWithShipping, // Save validated address snapshot
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: { select: { name: true, images: true } },
              variant: { select: { name: true } },
            },
          },
        },
      });
    });

    // Always notify the admin when a new order is created (regardless of payment method)
    this.mailService.sendAdminOrderAlert(user, order);

    // Send customer confirmation immediately only for Cash On Delivery;
    // for Wompi payments, the customer email is sent once the order moves to PROCESSING
    if (paymentMethod === 'CASH_ON_DELIVERY') {
      this.mailService.sendOrderConfirmation(user, order);
    }

    return order;
  }

  findAll(userId?: string) {
    const where = userId ? { userId } : {};
    return this.prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true, variant: true } },
        user: { select: { id: true, email: true, name: true, taxId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, variant: true } },
        user: { select: { id: true, email: true, name: true, taxId: true } },
      },
    });
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const updated = await this.prisma.order.update({
      where: { id },
      data: updateOrderDto,
      include: {
        items: {
          include: {
            product: { select: { name: true, images: true } },
            variant: { select: { name: true } },
          },
        },
        user: true,
      },
    });

    // When the order moves to PROCESSING, send confirmation to the customer
    // (admin was already notified when the order was created in PENDING)
    if (updateOrderDto.status === 'PROCESSING') {
      this.mailService.sendOrderConfirmation(updated.user, updated);
    }

    return updated;
  }

  async remove(id: string) {
    // Delete referenced order items first to avoid foreign key constraints
    await this.prisma.orderItem.deleteMany({
      where: { orderId: id },
    });

    return this.prisma.order.delete({
      where: { id },
    });
  }
}
