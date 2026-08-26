import { Test, TestingModule } from '@nestjs/testing';
import { WompiController } from './wompi.controller';
import { WompiService } from './wompi.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

const SECRET = 'test_secret';
const ORDER_ID = 'order_123';
const TX_ID = 'tr_test_123';

// Wompi manda en `signature.properties` que campos entran a la firma y en que
// orden; el servicio los lee de ahi en vez de asumirlos. Un payload sin ellos
// no viene de Wompi.
const DEFAULT_PROPERTIES = [
  'transaction.id',
  'transaction.status',
  'transaction.amount_in_cents',
];

/**
 * Arma un evento de Wompi firmado como lo firmaria Wompi. Por defecto es un
 * APPROVED de $100 (10000 centavos) para la orden `order_123`.
 */
function buildEvent(
  overrides: {
    id?: string;
    status?: string;
    reference?: string;
    amountInCents?: number;
    properties?: string[];
    checksum?: string;
  } = {},
) {
  const {
    id = TX_ID,
    status = 'APPROVED',
    reference = ORDER_ID,
    amountInCents = 10000,
    properties = DEFAULT_PROPERTIES,
  } = overrides;

  const timestamp = Date.now();
  const transaction = {
    id,
    amount_in_cents: amountInCents,
    reference,
    currency: 'COP',
    status,
  };

  const data = { transaction };
  const values = properties.map((prop) => {
    const parts = prop.split('.');
    let value: any = data;
    for (const part of parts) value = value?.[part];
    return value;
  });

  const checksum =
    overrides.checksum ??
    createHash('sha256')
      .update([...values, timestamp, SECRET].join(''))
      .digest('hex');

  return {
    event: 'transaction.updated',
    data,
    timestamp,
    signature: { properties, checksum },
    environment: 'test',
  };
}

/** Orden en la base tal como la lee el webhook. `total: 100` = 10000 centavos. */
function buildOrder(overrides: Record<string, any> = {}) {
  return {
    id: ORDER_ID,
    userId: 'user_123',
    status: 'PENDING',
    paymentId: null,
    total: 100,
    // restoreStock vuelve a leer la orden con sus items; que vengan aqui deja
    // verificar que el stock se devuelve (o que no se devuelve).
    items: [
      { id: 'item_1', productId: 'prod_1', variantId: 'var_1', quantity: 2 },
    ],
    user: { id: 'user_123', email: 'cliente@example.com', name: 'Cliente' },
    ...overrides,
  };
}

describe('Wompi Webhook (Custom E2E)', () => {
  let controller: WompiController;

  const mockPrismaService = {
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    variant: { update: jest.fn() },
    product: { update: jest.fn() },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockConfigService = {
    get: jest.fn((key: string) =>
      key === 'WOMPI_EVENTS_SECRET' ? SECRET : null,
    ),
  };

  // Mockeado a proposito: un pago aprobado dispara los correos al cliente y al
  // admin, y en un test no se le escribe a nadie de verdad.
  const mockMailService = {
    sendOrderConfirmation: jest.fn(),
    sendAdminOrderAlert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WompiController],
      providers: [
        WompiService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    controller = module.get<WompiController>(WompiController);

    jest.clearAllMocks();
    // Por defecto el update devuelve algo con la forma del include real: el
    // servicio le pasa `updatedOrder.user` al MailService.
    mockPrismaService.order.update.mockImplementation(({ data }: any) =>
      Promise.resolve(buildOrder({ status: data.status ?? 'PENDING' })),
    );
  });

  describe('firma y payload', () => {
    it('rechaza un webhook sin signature.properties', async () => {
      // Con properties vacio la firma solo cubriria timestamp+secret, asi que
      // el mismo checksum validaria cualquier monto o estado. Se rechaza antes
      // de tocar la orden.
      const timestamp = Date.now();
      const checksum = createHash('sha256')
        .update(`${timestamp}${SECRET}`)
        .digest('hex');

      const payload = {
        event: 'transaction.updated',
        data: {
          transaction: {
            id: 'tr_forjada',
            amount_in_cents: 1,
            reference: ORDER_ID,
            currency: 'COP',
            status: 'APPROVED',
          },
        },
        timestamp,
        signature: { properties: [], checksum },
        environment: 'test',
      };

      await expect(controller.handleWebhook(payload)).rejects.toThrow(
        'Invalid signature',
      );
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
      expect(mockMailService.sendOrderConfirmation).not.toHaveBeenCalled();
    });

    it('rechaza un checksum que no corresponde al payload', async () => {
      const payload = buildEvent({ checksum: 'no-es-el-hash-correcto' });

      await expect(controller.handleWebhook(payload)).rejects.toThrow(
        'Invalid signature',
      );
      expect(mockPrismaService.order.findUnique).not.toHaveBeenCalled();
    });

    it('responde order_not_found si la referencia no existe', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      const result = await controller.handleWebhook(buildEvent());

      expect(result).toEqual({ status: 'order_not_found' });
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });

    it('deja la orden PENDING si pagaron menos de lo que vale', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(buildOrder());

      // La orden vale 10000 centavos; pagan 5000.
      const result = await controller.handleWebhook(
        buildEvent({ amountInCents: 5000 }),
      );

      expect(result).toEqual({ status: 'amount_mismatch' });
      // Se graba el paymentId igual: hubo plata de por medio y tiene que
      // quedar rastro para la revision manual.
      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        data: { paymentId: TX_ID },
      });
      expect(mockMailService.sendOrderConfirmation).not.toHaveBeenCalled();
    });
  });

  describe('APPROVED', () => {
    it('pasa una orden PENDING a PROCESSING y manda los correos', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(buildOrder());

      const result = await controller.handleWebhook(buildEvent());

      expect(result).toEqual({ status: 'ok' });
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
      });
      // objectContaining en el nivel de arriba porque la llamada real trae
      // ademas un `include` de items y user que a este test no le importa.
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORDER_ID },
          data: expect.objectContaining({
            status: 'PROCESSING',
            paymentId: TX_ID,
          }),
        }),
      );

      // Los correos de confirmacion solo salen desde aqui, no al crear la
      // orden: si esto se rompe, el cliente paga y no recibe ningun aviso.
      expect(mockMailService.sendOrderConfirmation).toHaveBeenCalled();
      expect(mockMailService.sendAdminOrderAlert).toHaveBeenCalled();
    });

    // El incidente del 22 de agosto de 2026: el cliente pago, pero el APPROVED
    // se demoro 11 minutos y alguien ya habia movido la orden a PROCESSING a
    // mano. El webhook entraba, no encontraba cambio de estado y se iba sin
    // grabar nada, dejando la orden pagada indistinguible de una abandonada.
    it('graba el paymentId aunque la orden ya estuviera en PROCESSING', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(
        buildOrder({ status: 'PROCESSING' }),
      );

      const result = await controller.handleWebhook(buildEvent());

      expect(result).toEqual({ status: 'ok' });
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORDER_ID },
          data: expect.objectContaining({ paymentId: TX_ID }),
        }),
      );
      // El estado no se toca: ya estaba donde debia estar.
      const { data } = mockPrismaService.order.update.mock.calls[0][0];
      expect(data.status).toBeUndefined();
      // Y los correos NO se repiten: el cambio manual ya los mando.
      expect(mockMailService.sendOrderConfirmation).not.toHaveBeenCalled();
      expect(mockMailService.sendAdminOrderAlert).not.toHaveBeenCalled();
    });

    it('no vuelve a escribir el paymentId si ya es el mismo', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(
        buildOrder({ status: 'PROCESSING', paymentId: TX_ID }),
      );

      const result = await controller.handleWebhook(buildEvent());

      expect(result).toEqual({ status: 'ok' });
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });

    // Un rechazo cancela la orden; si el cliente reintenta y paga con la misma
    // referencia, el APPROVED tiene que revivirla. Antes no lo hacia: el
    // cliente pagaba, la orden quedaba cancelada y nadie despachaba.
    it('reactiva una orden CANCELLED cuando el reintento se aprueba', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(
        buildOrder({ status: 'CANCELLED' }),
      );

      const result = await controller.handleWebhook(buildEvent());

      expect(result).toEqual({ status: 'ok' });
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PROCESSING',
            paymentId: TX_ID,
          }),
        }),
      );
      // Aqui si van correos: la cancelacion previa significa que nunca se
      // mando la confirmacion.
      expect(mockMailService.sendOrderConfirmation).toHaveBeenCalled();
    });

    it('no reabre una orden ya despachada', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(
        buildOrder({ status: 'SHIPPED', paymentId: TX_ID }),
      );

      const result = await controller.handleWebhook(buildEvent());

      expect(result).toEqual({ status: 'ok' });
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
      expect(mockMailService.sendOrderConfirmation).not.toHaveBeenCalled();
    });
  });

  describe('DECLINED / VOIDED / ERROR', () => {
    it('cancela una orden PENDING y devuelve el stock', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(buildOrder());

      const result = await controller.handleWebhook(
        buildEvent({ status: 'DECLINED' }),
      );

      expect(result).toEqual({ status: 'ok' });
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      // El create descuenta stock de una, asi que cancelar tiene que devolverlo.
      expect(mockPrismaService.variant.update).toHaveBeenCalledWith({
        where: { id: 'var_1' },
        data: { stock: { increment: 2 } },
      });
      expect(mockMailService.sendOrderConfirmation).not.toHaveBeenCalled();
    });

    // Los reintentos comparten la misma referencia, asi que un DECLINED del
    // primer intento puede llegar despues del APPROVED del segundo. Cancelar
    // ahi seria tumbar una orden pagada y devolver stock que si se vendio.
    it('ignora un rechazo tardio sobre una orden ya pagada', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(
        buildOrder({ status: 'PROCESSING', paymentId: 'tr_intento_2' }),
      );

      const result = await controller.handleWebhook(
        buildEvent({ id: 'tr_intento_1', status: 'DECLINED' }),
      );

      expect(result).toEqual({ status: 'ok' });
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
      expect(mockPrismaService.variant.update).not.toHaveBeenCalled();
    });

    it('no devuelve el stock dos veces si ya estaba cancelada', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(
        buildOrder({ status: 'CANCELLED' }),
      );

      const result = await controller.handleWebhook(
        buildEvent({ status: 'VOIDED' }),
      );

      expect(result).toEqual({ status: 'ok' });
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
      expect(mockPrismaService.variant.update).not.toHaveBeenCalled();
    });
  });
});
