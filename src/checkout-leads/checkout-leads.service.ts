import { Injectable, NotFoundException } from '@nestjs/common';
import { CheckoutLead, CheckoutLeadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCheckoutLeadDto } from './dto/upsert-checkout-lead.dto';
import { UpdateCheckoutLeadDto } from './dto/update-checkout-lead.dto';
import {
  ShippingService,
  FREE_SHIPPING_THRESHOLD,
  DEFAULT_SHIPPING_COST,
} from '../shipping/shipping.service';

/** Snapshot del carrito, resuelto en el servidor para que el precio sea real. */
type LeadItemSnapshot = {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  quantity: number;
  price: number;
  image?: string;
};

/**
 * Carritos abandonados en el checkout.
 *
 * La captura ocurre mientras el cliente llena el formulario, antes de pagar,
 * asi que este servicio no puede tener ningun efecto secundario: no crea
 * usuarios, no descuenta stock y no consume cupones. Si algo de eso hiciera
 * falta, va en OrdersService, no aqui.
 */
@Injectable()
export class CheckoutLeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
  ) {}

  /**
   * Guarda o refresca el lead del navegador. Se llama varias veces por visita
   * (cada vez que el cliente completa un campo), por eso es un upsert sobre
   * sessionId y no un create: un visitante = una fila.
   */
  async upsert(dto: UpsertCheckoutLeadDto, userId?: string) {
    const items = await this.resolveItems(dto.items);
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const data = {
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone,
      name: dto.name,
      shippingAddress: (dto.shippingAddress ?? undefined) as any,
      items: items as any,
      subtotal,
      userId,
      capturedAt: new Date(),
    };

    const lead = await this.prisma.checkoutLead.upsert({
      where: { sessionId: dto.sessionId },
      create: { sessionId: dto.sessionId, ...data },
      update: data,
    });

    // El navegador no necesita nada de vuelta; se responde lo minimo para no
    // filtrar datos por un endpoint publico.
    return { id: lead.id };
  }

  /**
   * Precio y nombre salen de la base de datos, nunca del cliente. De paso
   * descarta productos que ya no existen.
   */
  private async resolveItems(
    items: UpsertCheckoutLeadDto['items'],
  ): Promise<LeadItemSnapshot[]> {
    if (!items?.length) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      include: { variants: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const snapshots: LeadItemSnapshot[] = [];
    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) continue;

      const variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : undefined;

      snapshots.push({
        productId: product.id,
        variantId: variant?.id,
        name: product.name,
        variantName: variant?.name,
        quantity: item.quantity,
        price: variant?.price ?? product.price,
        image: product.images?.[0],
      });
    }
    return snapshots;
  }

  /**
   * Leads pendientes de trabajar. Un lead se considera convertido si el mismo
   * correo tiene una orden no cancelada posterior a la captura, en vez de
   * marcarse con un estado: asi un pago rechazado por Wompi devuelve el lead a
   * la lista solo, sin que nadie tenga que acordarse de revertirlo.
   */
  async findAll(includeConverted = false) {
    const leads = await this.prisma.checkoutLead.findMany({
      orderBy: { capturedAt: 'desc' },
      take: 500,
    });
    if (!leads.length) return [];

    const converted = await this.findConvertedEmails(leads);

    const decorated = leads.map((lead) => ({
      ...lead,
      converted: this.isConverted(lead, converted),
    }));

    const visible = includeConverted
      ? decorated
      : decorated.filter(
          (lead) => !lead.converted && lead.status !== CheckoutLeadStatus.LOST,
        );

    // El envio se calcula solo sobre lo que se va a mostrar: resolverlo para
    // leads ya convertidos o perdidos seria trabajo tirado a la basura.
    return this.withShipping(visible);
  }

  /**
   * Un lead concreto, con el envio ya resuelto.
   *
   * Lo usa el editor de ordenes manuales para precargar el carrito abandonado,
   * asi que a diferencia de findAll no esconde los convertidos ni los perdidos:
   * quien abre el link ya decidio que quiere trabajar ese lead. El flag
   * `converted` viaja igual para poder advertirle que ya existe una orden.
   */
  async findOne(id: string) {
    const lead = await this.prisma.checkoutLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead no encontrado');

    const converted = await this.findConvertedEmails([lead]);
    const [decorated] = await this.withShipping([
      { ...lead, converted: this.isConverted(lead, converted) },
    ]);

    return decorated;
  }

  /**
   * Zona de envio del snapshot de direccion.
   *
   * Hay que leer dos formas distintas: el invitado guarda la direccion tal como
   * la escribio en el formulario (address_1 / province) y el cliente con sesion
   * guarda la que devuelve la API (street / state). El tipo Address del store
   * declara province en ambos casos, pero al leer nunca se mapea, asi que la
   * forma real depende de si habia sesion.
   */
  private readZone(shippingAddress: unknown) {
    if (!shippingAddress || typeof shippingAddress !== 'object') return null;

    const addr = shippingAddress as Record<string, unknown>;
    const text = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined;

    const city = text(addr.city);
    const state = text(addr.state) ?? text(addr.province);

    if (!city && !state) return null;
    return { city, state };
  }

  /**
   * Agrega a cada lead el envio que le corresponde y cuanto le falta al carrito
   * para el envio gratis. Son los dos numeros con los que se negocia el cierre
   * por WhatsApp: la tarifa es fija por zona, asi que se puede derivar de la
   * direccion en vez de guardarla en la captura.
   *
   * Se usan las tarifas VIGENTES, no las del dia de la captura: el precio que
   * importa es el que se va a ofrecer hoy.
   */
  private async withShipping<T extends CheckoutLead & { converted: boolean }>(
    leads: T[],
  ) {
    // Las tarifas se traen UNA vez y se resuelven en memoria. Antes esto
    // llamaba a findRate por zona, que a su vez hacia hasta 3 consultas: con 18
    // zonas distintas eran ~54 idas y vueltas a la base y el endpoint tardaba
    // mas de 7 segundos.
    const rateFor = await this.shipping.createRateResolver();

    const result: (T & {
      shippingCost: number | null;
      freeShippingGap: number | null;
    })[] = [];

    for (const lead of leads) {
      if (lead.subtotal >= FREE_SHIPPING_THRESHOLD) {
        // Ya tenia envio gratis, asi que el abandono no fue por el envio.
        // Distinguirlo importa: cambia por completo lo que hay que preguntarle
        // al cliente.
        result.push({ ...lead, shippingCost: 0, freeShippingGap: null });
        continue;
      }

      const zone = this.readZone(lead.shippingAddress);
      result.push({
        ...lead,
        // null y no un numero inventado: sin direccion no se sabe la zona, y
        // mostrar una tarifa cualquiera llevaria a ofrecer un precio erroneo.
        shippingCost: zone
          ? (rateFor('Colombia', zone.state, zone.city)?.price ??
            DEFAULT_SHIPPING_COST)
          : null,
        freeShippingGap: FREE_SHIPPING_THRESHOLD - lead.subtotal,
      });
    }

    return result;
  }

  /** email -> fechas de ordenes no canceladas, para cruzar contra capturedAt. */
  private async findConvertedEmails(leads: CheckoutLead[]) {
    const oldest = leads.reduce(
      (min, l) => (l.capturedAt < min ? l.capturedAt : min),
      leads[0].capturedAt,
    );

    const orders = await this.prisma.order.findMany({
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: oldest },
        user: { email: { in: leads.map((l) => l.email) } },
      },
      select: { createdAt: true, user: { select: { email: true } } },
    });

    const map = new Map<string, Date[]>();
    for (const order of orders) {
      const email = order.user.email.toLowerCase();
      map.set(email, [...(map.get(email) ?? []), order.createdAt]);
    }
    return map;
  }

  private isConverted(lead: CheckoutLead, converted: Map<string, Date[]>) {
    const dates = converted.get(lead.email.toLowerCase());
    return !!dates?.some((date) => date >= lead.capturedAt);
  }

  async update(id: string, dto: UpdateCheckoutLeadDto) {
    const lead = await this.prisma.checkoutLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead no encontrado');

    return this.prisma.checkoutLead.update({
      where: { id },
      data: {
        ...dto,
        // La marca de tiempo se pone sola al pasar a CONTACTED, para no
        // depender de que el admin la mande.
        contactedAt:
          dto.status === CheckoutLeadStatus.CONTACTED && !lead.contactedAt
            ? new Date()
            : undefined,
      },
    });
  }

  async remove(id: string) {
    const lead = await this.prisma.checkoutLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    return this.prisma.checkoutLead.delete({ where: { id } });
  }
}
