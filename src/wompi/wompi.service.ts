import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { createHash } from 'crypto';

@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async handleWebhook(data: any) {
    // Wompi sends the event structure: { event: string, data: { transaction: ... }, signature: { checksum: ... }, timestamp: number, environment: string }
    // Or sometimes just the transaction object depending on configuration, but usually wrapped in event.
    // Based on Wompi docs, the payload has `event`, `data`, `sent_at`, `signature`.

    // Check if it's a test event or actual transaction
    if (data.event === 'nequi_token_updated') {
      this.logger.log('Received Nequi token update event. Ignoring.');
      return { status: 'ok' };
    }

    if (data.event !== 'transaction.updated') {
      this.logger.log(`Received event ${data.event}. Ignoring.`);
      return { status: 'ok' };
    }

    const transaction = data.data.transaction;

    if (!transaction) {
      throw new BadRequestException(
        'Invalid payload: transaction data missing',
      );
    }

    const { id, status, reference } = transaction;
    const timestamp = data.timestamp;
    const signatureChecksum = data.signature?.checksum;
    const signatureProperties: string[] = data.signature?.properties || [];

    // Verify Signature using dynamic properties from Wompi
    const secret = this.configService.get<string>('WOMPI_EVENTS_SECRET');
    if (!secret) {
      this.logger.error(
        'WOMPI_EVENTS_SECRET is not defined in environment variables',
      );
      throw new BadRequestException('Server misconfiguration');
    }

    // Build signature string from the properties Wompi tells us to use
    // Each property is a path like "transaction.id", "transaction.status", etc.
    const propertyValues = signatureProperties.map((prop: string) => {
      const parts = prop.split('.');
      let value: any = data.data;
      for (const part of parts) {
        value = value?.[part];
      }
      return value;
    });

    const signatureString = [...propertyValues, timestamp, secret].join('');
    const calculatedChecksum = createHash('sha256')
      .update(signatureString)
      .digest('hex');

    this.logger.log(
      `Webhook signature check — properties: ${signatureProperties.join(', ')}, values: ${propertyValues.join(', ')}`,
    );

    if (calculatedChecksum !== signatureChecksum) {
      this.logger.error(
        `Invalid signature for Wompi webhook. Calculated: ${calculatedChecksum}, Received: ${signatureChecksum}`,
      );
      throw new BadRequestException('Invalid signature');
    }

    this.logger.log(
      `Processing transaction ${id} with status ${status} for reference ${reference}`,
    );

    // reference = Order ID (UUID) — el store lo envía como reference al crear el widget
    const order = await this.prisma.order.findUnique({
      where: { id: reference },
    });

    if (!order) {
      this.logger.warn(
        `Order not found for reference (order ID) ${reference}`,
      );
      return { status: 'order_not_found' };
    }

    let newStatus = order.status;

    if (status === 'APPROVED') {
      // If it was already processed, ignore?
      if (order.status === 'PENDING') {
        // Logic to start processing (e.g. if we didn't deduct stock before, do it now?
        // Logic in OrderService.create decrements stock IMMEDIATELY.
        // So if it fails, we should technically restore stock.
        // But usually we just mark as PAID/PROCESSING.
        newStatus = 'PROCESSING'; // or whatever enum maps to PAID. Schema has PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED.
        // Let's use PROCESSING for Paid.
      }
    } else if (
      status === 'DECLINED' ||
      status === 'VOIDED' ||
      status === 'ERROR'
    ) {
      if (order.status !== 'CANCELLED') {
        newStatus = 'CANCELLED';
        // TODO: Restore stock if we deducted it on creation?
        // OrderService.create deducted stock. So yes, should restore.
      }
    }

    if (newStatus !== order.status) {
      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          paymentId: id,
        },
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

      // Enviar correos de confirmación cuando el pago es aprobado
      if (newStatus === 'PROCESSING') {
        try {
          await this.mailService.sendOrderConfirmation(updatedOrder.user, updatedOrder);
          await this.mailService.sendAdminOrderAlert(updatedOrder.user, updatedOrder);
          this.logger.log(`Confirmation emails sent for order ${order.id}`);
        } catch (emailError) {
          this.logger.error(
            `Failed to send confirmation emails for order ${order.id}`,
            emailError,
          );
        }
      }

      // Si se cancela, restaurar stock
      if (newStatus === 'CANCELLED' && order.status !== 'CANCELLED') {
        await this.restoreStock(order.id);
      }

      this.logger.log(`Order ${order.id} status updated to ${newStatus}`);
    }

    return { status: 'ok' };
  }

  private async restoreStock(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.variantId) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    });

    this.logger.log(`Stock restored for order ${orderId}`);
  }
}
