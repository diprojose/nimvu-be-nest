import { calculatePrice, type PricingParams } from './pricing.calculator';

/** Los mismos valores por defecto del esquema, para razonar con numeros reales. */
const PARAMS: PricingParams = {
  filamentPricePerKg: 80000,
  wastePercent: 0.06,
  printerWatts: 120,
  energyPricePerKwh: 950,
  printerCost: 3000000,
  printerLifeHours: 5000,
  laborPricePerHour: 15000,
  packagingCost: 2000,
  targetMargin: 0.5,
  paymentFeePercent: 0.0315,
  roundingStep: 500,
};

/** Piezas reales del catalogo, para que los casos no sean abstractos. */
const MONSTERA = { grams: 250, hours: 10, laborMinutes: 15 };
const FIGURA_DETALLADA = { grams: 40, hours: 8, laborMinutes: 25 };

describe('calculatePrice', () => {
  it('cobra el filamento a lo que costo el rollo', () => {
    const r = calculatePrice(MONSTERA, PARAMS);

    // 250 g de un rollo de $80.000 el kilo.
    expect(r.material).toBe(20000);
  });

  it('cobra la merma sobre el material y no como monto fijo', () => {
    const grande = calculatePrice({ ...MONSTERA, grams: 500 }, PARAMS);
    const pequena = calculatePrice({ ...MONSTERA, grams: 50 }, PARAMS);

    // Perder una pieza grande desperdicia mas filamento que perder una chica.
    expect(grande.waste).toBeCloseTo(pequena.waste * 10);
  });

  it('cobra la depreciacion de la impresora por hora', () => {
    const r = calculatePrice(MONSTERA, PARAMS);

    // $3.000.000 sobre 5.000 horas = $600/hora, por 10 horas.
    expect(r.depreciation).toBe(6000);
  });

  it('la depreciacion pesa mas que la luz', () => {
    const r = calculatePrice(MONSTERA, PARAMS);

    // Es lo que suele sorprender: la impresora se gasta mas rapido de lo que
    // consume, y el x3 se justificaba en "la luz".
    expect(r.depreciation).toBeGreaterThan(r.energy * 3);
  });

  it('entrega el margen objetivo que se le pide', () => {
    const r = calculatePrice(MONSTERA, { ...PARAMS, roundingStep: 1 });

    // Dividir por (1 - margen) da el margen pedido; multiplicar por un factor
    // no. Con step 1 el redondeo no ensucia la comparacion.
    expect(r.margin).toBeCloseTo(0.5, 4);
  });

  it('nunca redondea hacia abajo', () => {
    const r = calculatePrice(MONSTERA, PARAMS);

    expect(r.roundedPrice).toBeGreaterThanOrEqual(r.suggestedPrice);
    expect(r.roundedPrice % PARAMS.roundingStep).toBe(0);
  });

  it('la comision de la pasarela baja el margen', () => {
    const r = calculatePrice(MONSTERA, PARAMS);

    expect(r.marginAfterFee).toBeLessThan(r.margin);
  });

  describe('lo que el metodo viejo escondia', () => {
    /** El metodo anterior: precio = costo de material x 3. */
    const precioViejo = (grams: number) =>
      grams * (PARAMS.filamentPricePerKg / 1000) * 3;

    it('una pieza pequena y lenta se vendia por debajo del costo', () => {
      const r = calculatePrice(FIGURA_DETALLADA, PARAMS);

      // 40 g gastan poco filamento, pero son 8 horas de impresora y 25 minutos
      // de trabajo. El x3 sobre material ni siquiera cubria el costo.
      expect(precioViejo(FIGURA_DETALLADA.grams)).toBeLessThan(r.cost);
      expect(r.roundedPrice).toBeGreaterThan(
        precioViejo(FIGURA_DETALLADA.grams),
      );
    });

    it('en una pieza grande y rapida el x3 daba menos margen del que aparentaba', () => {
      const r = calculatePrice(MONSTERA, PARAMS);
      const viejo = precioViejo(MONSTERA.grams);
      const margenViejo = (viejo - r.cost) / viejo;

      // x3 se siente como 66% de margen, pero contra el costo completo baja
      // bastante: por eso el objetivo se fija sobre el precio y no sobre el
      // material.
      expect(margenViejo).toBeLessThan(0.5);
    });
  });

  describe('envio gratis', () => {
    const opciones = { freeShippingThreshold: 150000, maxShippingCost: 19900 };

    it('no lo menciona cuando el producto no alcanza el umbral', () => {
      const r = calculatePrice(MONSTERA, PARAMS, opciones);

      expect(r.roundedPrice).toBeLessThan(150000);
      expect(r.marginWithFreeShipping).toBeNull();
    });

    it('avisa cuanto margen se come cuando el producto solo lo dispara', () => {
      const r = calculatePrice({ grams: 900, hours: 30, laborMinutes: 60 }, PARAMS, opciones);

      expect(r.roundedPrice).toBeGreaterThanOrEqual(150000);
      expect(r.marginWithFreeShipping).not.toBeNull();
      expect(r.marginWithFreeShipping!).toBeLessThan(r.marginAfterFee);
    });
  });

  describe('entradas que romperian el calculo', () => {
    it('no divide por cero si la vida util de la impresora es 0', () => {
      const r = calculatePrice(MONSTERA, { ...PARAMS, printerLifeHours: 0 });

      expect(r.depreciation).toBe(0);
      expect(Number.isFinite(r.cost)).toBe(true);
    });

    it('topa el margen para que el precio no se dispare al infinito', () => {
      const r = calculatePrice(MONSTERA, { ...PARAMS, targetMargin: 1 });

      expect(Number.isFinite(r.roundedPrice)).toBe(true);
    });

    it('trata los negativos como cero en vez de restar costo', () => {
      const r = calculatePrice({ grams: -100, hours: -5, laborMinutes: -10 }, PARAMS);

      // Sin esto unos gramos negativos harian bajar el costo del empaque.
      expect(r.cost).toBe(PARAMS.packagingCost);
    });
  });
});
