import { Test, TestingModule } from '@nestjs/testing';
import { WompiController } from './wompi.controller';
import { WompiService } from './wompi.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

describe('Wompi Webhook (Custom E2E)', () => {
  let controller: WompiController;
  let service: WompiService;
  let prismaService: any;
  let configService: any;

  const mockPrismaService = {
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    variant: {
      update: jest.fn(),
    },
    product: {
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'WOMPI_EVENTS_SECRET') return 'test_secret';
      return null;
    }),
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
    service = module.get<WompiService>(WompiService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  it('should handle webhook successfully', async () => {
    const transactionId = 'tr_test_123';
    // La `reference` que se le manda a Wompi ES el id de la orden: asi el
    // webhook la encuentra directo. El fixture decia 'ref_order_123', de cuando
    // era un identificador aparte.
    const reference = 'order_123';
    const amountInCents = 10000;
    const currency = 'COP';
    const status = 'APPROVED';
    const timestamp = Date.now();
    const secret = 'test_secret';

    // Wompi manda en `signature.properties` que campos entran a la firma y en
    // que orden; el servicio los lee de ahi en vez de asumirlos. El payload de
    // este test no los traia, asi que el servicio firmaba solo timestamp+secret
    // y nunca coincidia.
    const signatureProperties = [
      'transaction.id',
      'transaction.status',
      'transaction.amount_in_cents',
    ];
    const signatureString = `${transactionId}${status}${amountInCents}${timestamp}${secret}`;
    const checksum = createHash('sha256').update(signatureString).digest('hex');

    const payload = {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: transactionId,
          amount_in_cents: amountInCents,
          reference: reference,
          currency: currency,
          status: status,
        },
      },
      timestamp: timestamp,
      signature: {
        properties: signatureProperties,
        checksum: checksum,
      },
      environment: 'test',
    };

    mockPrismaService.order.findUnique.mockResolvedValue({
      id: 'order_123',
      userId: 'user_123',
      status: 'PENDING',
      paymentId: null,
      // 100 * 100 = 10000 centavos, lo mismo que dice pagar la transaccion.
      // Si no cuadra, el servicio la deja PENDING por monto insuficiente.
      total: 100,
    });

    mockPrismaService.order.update.mockResolvedValue({
      id: 'order_123',
      status: 'PROCESSING',
      // El servicio le pasa `updatedOrder.user` al MailService, asi que el
      // mock tiene que traerlo como lo trae el include real.
      user: { id: 'user_123', email: 'cliente@example.com', name: 'Cliente' },
      items: [],
    });

    const result = await controller.handleWebhook(payload);

    expect(result).toEqual({ status: 'ok' });
    expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
      where: { id: reference },
    });
    // objectContaining en el nivel de arriba porque la llamada real trae
    // ademas un `include` de items y user que a este test no le importa.
    expect(mockPrismaService.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_123' },
        data: expect.objectContaining({
          status: 'PROCESSING',
          paymentId: transactionId,
        }),
      }),
    );

    // Los correos de confirmacion solo salen desde aqui, no al crear la orden:
    // si esto se rompe, el cliente paga y no recibe ningun aviso.
    expect(mockMailService.sendOrderConfirmation).toHaveBeenCalled();
    expect(mockMailService.sendAdminOrderAlert).toHaveBeenCalled();
  });

  it('rechaza un webhook sin signature.properties', async () => {
    // Con properties vacio la firma solo cubriria timestamp+secret, asi que el
    // mismo checksum validaria cualquier monto o estado. Se rechaza antes de
    // tocar la orden.
    const timestamp = Date.now();
    const checksum = createHash('sha256')
      .update(`${timestamp}test_secret`)
      .digest('hex');

    const payload = {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: 'tr_forjada',
          amount_in_cents: 1,
          reference: 'order_123',
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
});
