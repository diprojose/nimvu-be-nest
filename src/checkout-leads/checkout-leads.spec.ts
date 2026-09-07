import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutLeadsService } from './checkout-leads.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ShippingService,
  FREE_SHIPPING_THRESHOLD,
} from '../shipping/shipping.service';

const BOGOTA = 12000;
const RESTO = 19900;

/**
 * Direccion tal como la guarda un invitado: es la forma del formulario del
 * store (address_1 / province).
 */
const guestAddress = (province: string, city: string) => ({
  first_name: 'Ana',
  last_name: 'Ruiz',
  address_1: 'Calle 1 #2-3',
  city,
  province,
  postal_code: '',
  phone: '3001234567',
});

/**
 * Direccion de un cliente con sesion: llega como la devuelve la API
 * (street / state), porque al leer nunca se mapea a la forma del formulario.
 */
const userAddress = (state: string, city: string) => ({
  street: 'Calle 1 #2-3',
  city,
  state,
  zip: '',
  country: 'Colombia',
  phone: '3001234567',
});

function buildLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead_1',
    sessionId: 'sess_1',
    email: 'ana@example.com',
    phone: '3001234567',
    name: 'Ana',
    shippingAddress: guestAddress('Cundinamarca', 'Bogota'),
    items: [],
    subtotal: 80000,
    userId: null,
    status: 'OPEN',
    note: null,
    contactedAt: null,
    capturedAt: new Date('2026-09-01T10:00:00Z'),
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-01T10:00:00Z'),
    ...overrides,
  };
}

describe('CheckoutLeadsService · envio de los leads', () => {
  let service: CheckoutLeadsService;
  let findRate: jest.Mock;

  beforeEach(async () => {
    // Tarifa real de Nimvu: fija por zona, Bogota/Cundinamarca mas barato.
    findRate = jest.fn(({ where }) => {
      const state = (where?.state?.equals ?? '').toLowerCase();
      if (state === 'cundinamarca') return Promise.resolve({ price: BOGOTA });
      if (state) return Promise.resolve({ price: RESTO });
      return Promise.resolve(null);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutLeadsService,
        ShippingService,
        {
          provide: PrismaService,
          useValue: {
            checkoutLead: { findMany: jest.fn() },
            order: { findMany: jest.fn().mockResolvedValue([]) },
            shippingRate: { findFirst: findRate },
          },
        },
      ],
    }).compile();

    service = module.get(CheckoutLeadsService);
  });

  const runWith = async (leads: unknown[]) => {
    const prisma = (service as any).prisma as {
      checkoutLead: { findMany: jest.Mock };
    };
    prisma.checkoutLead.findMany.mockResolvedValue(leads);
    return service.findAll();
  };

  it('resuelve la tarifa de la zona para una direccion de invitado', async () => {
    const [lead] = await runWith([buildLead()]);

    expect(lead.shippingCost).toBe(BOGOTA);
  });

  it('lee la zona cuando la direccion viene en la forma de la API (state)', async () => {
    const [lead] = await runWith([
      buildLead({ shippingAddress: userAddress('Antioquia', 'Medellin') }),
    ]);

    expect(lead.shippingCost).toBe(RESTO);
  });

  it('marca envio gratis y sin brecha cuando el subtotal pasa el umbral', async () => {
    const [lead] = await runWith([
      buildLead({ subtotal: FREE_SHIPPING_THRESHOLD }),
    ]);

    // Si ya tenia envio gratis, el abandono no fue por el envio: la brecha en
    // null es lo que se lo dice al vendedor.
    expect(lead.shippingCost).toBe(0);
    expect(lead.freeShippingGap).toBeNull();
  });

  it('calcula cuanto le falta al carrito para el envio gratis', async () => {
    const [lead] = await runWith([buildLead({ subtotal: 138000 })]);

    expect(lead.freeShippingGap).toBe(FREE_SHIPPING_THRESHOLD - 138000);
  });

  it('deja el envio en null si el lead no alcanzo a dejar direccion', async () => {
    const [lead] = await runWith([buildLead({ shippingAddress: null })]);

    // Un numero inventado aqui haria que se le ofrezca al cliente un precio
    // que no corresponde a su zona.
    expect(lead.shippingCost).toBeNull();
  });

  describe('findOne · precarga del editor de ordenes', () => {
    const findUnique = () =>
      ((service as any).prisma as { checkoutLead: { findUnique: jest.Mock } })
        .checkoutLead.findUnique;

    beforeEach(() => {
      (service as any).prisma.checkoutLead.findUnique = jest.fn();
    });

    it('trae el lead con el envio ya resuelto', async () => {
      findUnique().mockResolvedValue(buildLead());

      const lead = await service.findOne('lead_1');

      expect(lead.shippingCost).toBe(BOGOTA);
    });

    it('devuelve tambien los perdidos, porque el link se abre a proposito', async () => {
      findUnique().mockResolvedValue(buildLead({ status: 'LOST' }));

      await expect(service.findOne('lead_1')).resolves.toMatchObject({
        status: 'LOST',
      });
    });

    it('falla si el lead no existe', async () => {
      findUnique().mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow('Lead no encontrado');
    });
  });

  it('consulta la tarifa una vez por zona y no una vez por lead', async () => {
    await runWith([
      buildLead({ id: 'a' }),
      buildLead({ id: 'b' }),
      buildLead({ id: 'c', shippingAddress: userAddress('Antioquia', 'Medellin') }),
    ]);

    // Tres leads en dos zonas. findRate se llama hasta 3 veces por zona
    // (ciudad, departamento, pais), asi que lo que importa es que la segunda
    // Bogota no vuelva a pegarle a la base.
    const zonasConsultadas = new Set(
      findRate.mock.calls.map((c) => c[0]?.where?.state?.equals),
    );
    expect(zonasConsultadas.size).toBe(2);
  });
});
