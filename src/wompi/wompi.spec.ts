
import { Test, TestingModule } from '@nestjs/testing';
import { WompiController } from './wompi.controller';
import { WompiService } from './wompi.service';
import { PrismaService } from '../prisma/prisma.service';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WompiController],
      providers: [
        WompiService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
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
    const reference = 'ref_order_123';
    const amountInCents = 10000;
    const currency = 'COP';
    const status = 'APPROVED';
    const timestamp = Date.now();
    const secret = 'test_secret';

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
        checksum: checksum,
      },
      environment: 'test',
    };

    mockPrismaService.order.findFirst.mockResolvedValue({
      id: 'order_123',
      userId: 'user_123',
      status: 'PENDING',
      paymentId: null,
      total: 100,
    });

    mockPrismaService.order.update.mockResolvedValue({
      id: 'order_123',
      status: 'PROCESSING',
    });

    const result = await controller.handleWebhook(payload);

    expect(result).toEqual({ status: 'ok' });
    expect(mockPrismaService.order.findFirst).toHaveBeenCalled();
    expect(mockPrismaService.order.update).toHaveBeenCalledWith({
      where: { id: 'order_123' },
      data: expect.objectContaining({ status: 'PROCESSING', paymentId: transactionId })
    });
  });
});
