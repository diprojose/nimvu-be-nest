/**
 * Costeo de un producto impreso en 3D.
 *
 * Se vive aparte del servicio y sin dependencias de Nest ni de Prisma para que
 * sea una funcion pura: es la unica logica de plata del proyecto y tenerla
 * aislada permite probarla sin levantar nada.
 *
 * El metodo que reemplaza era "precio = costo de material x 3". El problema de
 * ese multiplicador es que el material no es lo que mas varia entre productos:
 * una figura pequena y detallada gasta poco filamento pero ocupa la impresora
 * muchas horas y da mucho trabajo manual, asi que un x3 sobre material la
 * vendia por debajo del costo. Por eso aqui las horas y los minutos de
 * postproceso entran como variables propias.
 */

/** Costos del negocio. Sale de PricingSettings, una fila unica en la base. */
export interface PricingParams {
  filamentPricePerKg: number;
  wastePercent: number;
  printerWatts: number;
  energyPricePerKwh: number;
  printerCost: number;
  printerLifeHours: number;
  laborPricePerHour: number;
  packagingCost: number;
  targetMargin: number;
  paymentFeePercent: number;
  roundingStep: number;
}

/** Lo que Bambu Studio reporta del slice, mas el trabajo manual estimado. */
export interface PriceInput {
  /** Gramos de filamento. Usar el total del slice: ya incluye la purga. */
  grams: number;
  /** Horas de impresion. */
  hours: number;
  /** Minutos de trabajo manual: soportes, lijado, armado, empaque. */
  laborMinutes: number;
}

export interface PriceBreakdown {
  material: number;
  waste: number;
  energy: number;
  depreciation: number;
  labor: number;
  packaging: number;
  cost: number;
  /** Precio exacto que da el margen objetivo, antes de redondear. */
  suggestedPrice: number;
  /** El anterior redondeado hacia arriba; es el que se le pone al producto. */
  roundedPrice: number;
  /** Margen real con el precio redondeado. */
  margin: number;
  /** Lo que queda despues de la comision de la pasarela. */
  marginAfterFee: number;
  /**
   * Margen si el producto se vende solo y su precio ya dispara el envio gratis.
   * null cuando no alcanza el umbral, que es el caso normal.
   */
  marginWithFreeShipping: number | null;
}

/**
 * Redondeo hacia arriba: nunca a la baja. Bajar el precio para "que quede
 * bonito" se come margen que no esta de sobra.
 */
function roundUpTo(value: number, step: number) {
  if (step <= 0) return value;
  return Math.ceil(value / step) * step;
}

export function calculatePrice(
  input: PriceInput,
  params: PricingParams,
  /** Envio mas caro configurado, para el aviso de envio gratis. */
  options: { freeShippingThreshold?: number; maxShippingCost?: number } = {},
): PriceBreakdown {
  const grams = Math.max(0, input.grams);
  const hours = Math.max(0, input.hours);
  const laborMinutes = Math.max(0, input.laborMinutes);

  const material = grams * (params.filamentPricePerKg / 1000);
  // La merma va sobre el material y no como monto fijo: cuando falla una pieza
  // grande se pierde mucho mas filamento que cuando falla una pequena.
  const waste = material * params.wastePercent;

  const energy = hours * (params.printerWatts / 1000) * params.energyPricePerKwh;
  // Casi siempre pesa mas que la luz, que es lo que suele sorprender: la
  // impresora se gasta mucho mas rapido de lo que consume.
  const depreciation =
    params.printerLifeHours > 0
      ? hours * (params.printerCost / params.printerLifeHours)
      : 0;

  const labor = (laborMinutes / 60) * params.laborPricePerHour;
  const packaging = params.packagingCost;

  const cost = material + waste + energy + depreciation + labor + packaging;

  // Se divide por (1 - margen) en vez de multiplicar por un factor: asi pedir
  // 50% da 50% de verdad. Con un multiplicador nunca se sabe en que margen se
  // termino, que es justo lo que pasaba con el x3.
  const margin = Math.min(Math.max(params.targetMargin, 0), 0.95);
  const suggestedPrice = cost / (1 - margin);
  const roundedPrice = roundUpTo(suggestedPrice, params.roundingStep);

  const marginOf = (price: number, extraCost = 0) =>
    price > 0 ? (price - cost - extraCost) / price : 0;

  const threshold = options.freeShippingThreshold;
  const shipping = options.maxShippingCost ?? 0;
  const triggersFreeShipping =
    threshold !== undefined && roundedPrice >= threshold;

  return {
    material,
    waste,
    energy,
    depreciation,
    labor,
    packaging,
    cost,
    suggestedPrice,
    roundedPrice,
    margin: marginOf(roundedPrice),
    marginAfterFee: marginOf(
      roundedPrice,
      roundedPrice * params.paymentFeePercent,
    ),
    // Solo tiene sentido avisarlo cuando el producto por si solo pasa el
    // umbral: ahi el envio deja de cobrarse y sale del margen de esta venta.
    marginWithFreeShipping: triggersFreeShipping
      ? marginOf(roundedPrice, roundedPrice * params.paymentFeePercent + shipping)
      : null,
  };
}
