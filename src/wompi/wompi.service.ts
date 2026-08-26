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

    // Sin propiedades no hay nada de la transaccion dentro de la firma: el
    // string quedaria en timestamp+secret y el checksum validaria igual
    // cualquier monto o estado que venga en el payload. Wompi siempre las
    // manda, asi que un arreglo vacio es un payload que no viene de Wompi.
    if (!Array.isArray(signatureProperties) || signatureProperties.length === 0) {
      this.logger.error(
        `Webhook sin signature.properties para la transaccion ${id}; se rechaza.`,
      );
      throw new BadRequestException('Invalid signature');
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

    if (calculatedChecksum !== signatureChecksum) {
      this.logger.error(
        `Invalid signature. Calculated: ${calculatedChecksum}, Received: ${signatureChecksum}`,
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

    // Verificar que se pago lo que la orden vale. Sin esto, quien tenga el
    // secreto de integridad puede firmar un pago de $1.000 para una orden de
    // $500.000 y el webhook la aprobaria igual.
    if (status === 'APPROVED') {
      const paidCents = transaction.amount_in_cents;
      const expectedCents = Math.round(order.total * 100);
      // 100 centavos = $1, margen solo para redondeo de punto flotante.
      const TOLERANCE_CENTS = 100;

      if (typeof paidCents !== 'number') {
        this.logger.error(
          `Transaccion ${id} sin amount_in_cents; no se aprueba la orden ${order.id}`,
        );
        return { status: 'amount_missing' };
      }

      if (paidCents < expectedCents - TOLERANCE_CENTS) {
        // Se deja PENDING a proposito: el cliente si pago algo, asi que
        // cancelarla seria injusto, pero aprobarla seria despachar de mas.
        // Queda para revision manual.
        this.logger.error(
          `MONTO INSUFICIENTE en orden ${order.id}: pagaron ${paidCents} y se esperaban ${expectedCents} centavos (transaccion ${id}). Se deja PENDING para revision.`,
        );
        await this.prisma.order.update({
          where: { id: order.id },
          data: { paymentId: id },
        });
        return { status: 'amount_mismatch' };
      }

      if (paidCents > expectedCents + TOLERANCE_CENTS) {
        // Pagar de mas no es un ataque; se registra y se deja seguir.
        this.logger.warn(
          `Orden ${order.id}: se pago ${paidCents} y se esperaban ${expectedCents} centavos.`,
        );
      }
    }

    let newStatus = order.status;

    if (status === 'APPROVED') {
      // PENDING es el caso normal. CANCELLED entra porque los reintentos
      // comparten la misma referencia: si el primer intento fue rechazado y el
      // segundo se aprueba, hay que revivir la orden o el cliente paga y nadie
      // despacha. Los estados ya despachados (PACKED/SHIPPED/DELIVERED) y
      // PROCESSING se dejan quietos: ya estan donde deben.
      if (order.status === 'PENDING' || order.status === 'CANCELLED') {
        newStatus = 'PROCESSING';
      }
    } else if (
      status === 'DECLINED' ||
      status === 'VOIDED' ||
      status === 'ERROR'
    ) {
      // Solo desde PENDING. Un rechazo del primer intento puede llegar DESPUES
      // del aprobado del segundo (misma referencia); cancelar ahi seria tumbar
      // una orden pagada y devolver stock que si se vendio.
      if (order.status === 'PENDING') {
        newStatus = 'CANCELLED';
      } else {
        this.logger.warn(
          `Se ignora ${status} de la transaccion ${id}: la orden ${order.id} ya esta en ${order.status}.`,
        );
      }
    }

    const statusChanged = newStatus !== order.status;
    // El paymentId se graba aunque el estado no cambie. Sin esto, una orden que
    // alguien movio a mano antes de que llegara el webhook queda sin rastro del
    // pago, indistinguible de una abandonada.
    const shouldWritePaymentId =
      status === 'APPROVED' && order.paymentId !== id;

    if (statusChanged || shouldWritePaymentId) {
      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          ...(statusChanged ? { status: newStatus } : {}),
          ...(shouldWritePaymentId ? { paymentId: id } : {}),
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

      // Los correos salen solo cuando ESTA llamada movio la orden a PROCESSING.
      // Si ya venia en PROCESSING es porque un admin la adelanto a mano, y ese
      // camino (orders.service.update) ya mando la confirmacion: repetirla le
      // llegaria dos veces al cliente.
      if (statusChanged && newStatus === 'PROCESSING') {
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
      if (statusChanged && newStatus === 'CANCELLED') {
        await this.restoreStock(order.id);
      }

      // Revivir una orden cancelada NO vuelve a descontar inventario a
      // proposito: no hay forma de saber si el stock se habia devuelto (el
      // webhook lo devuelve, una cancelacion manual del admin no), y descontar
      // de mas es peor que quedar corto. Queda para revision humana.
      if (statusChanged && order.status === 'CANCELLED') {
        this.logger.error(
          `Orden ${order.id} REACTIVADA por pago aprobado (transaccion ${id}). ` +
            `Revisar inventario a mano: el stock pudo haberse devuelto al cancelarla.`,
        );
      }

      if (statusChanged) {
        this.logger.log(`Order ${order.id} status updated to ${newStatus}`);
      } else {
        this.logger.log(
          `Orden ${order.id}: se registro el pago ${id} sin cambiar el estado (${order.status}).`,
        );
      }
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
