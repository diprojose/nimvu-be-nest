import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService, DEFAULT_SHIPPING_COST, FREE_SHIPPING_THRESHOLD } from './shipping.service';
import { PrismaService } from '../prisma/prisma.service';

const BOGOTA = 12000;
const RESTO = 19900;
const CHIA = 9000;

/**
 * Tarifas como las tiene Nimvu, mas una a nivel de ciudad para poder verificar
 * que lo mas especifico gana.
 */
const RATES = [
  { id: 'r0', country: 'Colombia', state: 'Cundinamarca', city: 'Chia', price: CHIA },
  { id: 'r1', country: 'Colombia', state: 'Cundinamarca', city: null, price: BOGOTA },
  { id: 'r2', country: 'Colombia', state: null, city: null, price: RESTO },
];

describe('ShippingService · resolucion de tarifas', () => {
  let service: ShippingService;
  let findMany: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue(RATES);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        { provide: PrismaService, useValue: { shippingRate: { findMany } } },
      ],
    }).compile();

    service = module.get(ShippingService);
  });

  it('la ciudad gana sobre el departamento', async () => {
    const rate = await service.findRate('Colombia', 'Cundinamarca', 'Chia');

    expect(rate?.price).toBe(CHIA);
  });

  it('cae al departamento cuando la ciudad no tiene tarifa propia', async () => {
    const rate = await service.findRate('Colombia', 'Cundinamarca', 'Bogota');

    expect(rate?.price).toBe(BOGOTA);
  });

  it('cae a la regla de pais para el resto del pais', async () => {
    const rate = await service.findRate('Colombia', 'Antioquia', 'Medellin');

    expect(rate?.price).toBe(RESTO);
  });

  it('ignora mayusculas y espacios sobrantes', async () => {
    // Los clientes escriben la ciudad a mano; sin esto un "  chia" cobraria
    // la tarifa equivocada.
    const rate = await service.findRate('Colombia', '  cundinamarca  ', ' CHIA ');

    expect(rate?.price).toBe(CHIA);
  });

  it('resuelve en una sola consulta', async () => {
    await service.findRate('Colombia', 'Antioquia', 'Medellin');

    // Antes eran hasta 3 consultas encadenadas por cada busqueda.
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  describe('resolveShippingCost', () => {
    it('da envio gratis al pasar el umbral', async () => {
      const cost = await service.resolveShippingCost({
        subtotal: FREE_SHIPPING_THRESHOLD,
        state: 'Antioquia',
      });

      expect(cost).toBe(0);
    });

    it('cobra la tarifa de la zona por debajo del umbral', async () => {
      const cost = await service.resolveShippingCost({
        subtotal: 50000,
        state: 'Cundinamarca',
        city: 'Bogota',
      });

      expect(cost).toBe(BOGOTA);
    });

    it('usa el costo por defecto si no hay ninguna tarifa configurada', async () => {
      findMany.mockResolvedValue([]);

      const cost = await service.resolveShippingCost({ subtotal: 50000, state: 'Antioquia' });

      expect(cost).toBe(DEFAULT_SHIPPING_COST);
    });
  });

  describe('createRateResolver', () => {
    it('resuelve muchas zonas con una sola consulta', async () => {
      const rateFor = await service.createRateResolver();

      expect(rateFor('Colombia', 'Cundinamarca', 'Chia')?.price).toBe(CHIA);
      expect(rateFor('Colombia', 'Cundinamarca', 'Bogota')?.price).toBe(BOGOTA);
      expect(rateFor('Colombia', 'Antioquia', 'Medellin')?.price).toBe(RESTO);
      expect(rateFor('Colombia', 'Valle', 'Cali')?.price).toBe(RESTO);

      expect(findMany).toHaveBeenCalledTimes(1);
    });

    it('da el mismo resultado que la busqueda suelta', async () => {
      const rateFor = await service.createRateResolver();

      for (const [state, city] of [
        ['Cundinamarca', 'Chia'],
        ['Cundinamarca', 'Bogota'],
        ['Antioquia', 'Medellin'],
      ] as const) {
        const suelta = await service.findRate('Colombia', state, city);
        expect(rateFor('Colombia', state, city)?.price).toBe(suelta?.price);
      }
    });
  });
});
