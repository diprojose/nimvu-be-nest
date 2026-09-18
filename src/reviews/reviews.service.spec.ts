import { ForbiddenException, ConflictException } from '@nestjs/common';
import { OrderStatus, Prisma, ReviewStatus } from '@prisma/client';
import { ReviewsService } from './reviews.service';

/**
 * Las dos reglas que sostienen el modulo: solo resena quien compro, y nada se
 * publica sin moderar. Si alguna de estas pruebas se cae, el sello de "Compra
 * verificada" deja de significar algo.
 */

const PRODUCTO = 'prod-monstera';
const USUARIO = 'user-sergio';

/** Prisma falso: solo lo que el servicio realmente usa. */
function crearPrisma() {
  const tx = {
    review: {
      update: jest.fn().mockResolvedValue({ id: 'r-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'r-1' }),
      aggregate: jest.fn().mockResolvedValue({
        _avg: { rating: 0 },
        _count: { rating: 0 },
      }),
    },
    product: { update: jest.fn().mockResolvedValue({}) },
  };

  return {
    tx,
    order: { findFirst: jest.fn().mockResolvedValue(null) },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ name: 'Sergio Preciado', email: 's@x.com' }),
    },
    product: { findUnique: jest.fn().mockResolvedValue({ slug: 'monstera' }) },
    review: {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'r-1', status: ReviewStatus.PENDING }),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };
}

const crearTokens = () => ({
  create: jest.fn().mockReturnValue('token'),
  verify: jest.fn().mockReturnValue(null),
  buildUrl: jest.fn().mockReturnValue(null),
});

const crearServicio = (prisma: any, revalidation: any = { revalidate: jest.fn() }) =>
  new ReviewsService(prisma as any, revalidation as any, crearTokens() as any);

describe('ReviewsService - quien puede resenar', () => {
  it('rechaza a quien nunca compro el producto', async () => {
    const prisma = crearPrisma();
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      crearServicio(prisma).create(USUARIO, {
        productId: PRODUCTO,
        rating: 5,
        comment: 'Muy bueno',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.review.create).not.toHaveBeenCalled();
  });

  it('solo cuenta las ordenes ENTREGADAS', async () => {
    const prisma = crearPrisma();
    prisma.order.findFirst.mockResolvedValue({ id: 'o-1' });

    await crearServicio(prisma).create(USUARIO, {
      productId: PRODUCTO,
      rating: 5,
      comment: 'Muy bueno',
    });

    // Una orden pagada pero aun no entregada no da derecho a resenar.
    const where = prisma.order.findFirst.mock.calls[0][0].where;
    expect(where.status).toBe(OrderStatus.DELIVERED);
    expect(where.userId).toBe(USUARIO);
    expect(where.items.some.productId).toBe(PRODUCTO);
  });

  it('deja resenar a quien si compro', async () => {
    const prisma = crearPrisma();
    prisma.order.findFirst.mockResolvedValue({ id: 'o-1' });

    await expect(
      crearServicio(prisma).create(USUARIO, {
        productId: PRODUCTO,
        rating: 4,
        comment: 'Bonito',
      }),
    ).resolves.toBeDefined();
  });

  it('traduce la resena duplicada a un 409 legible', async () => {
    const prisma = crearPrisma();
    prisma.order.findFirst.mockResolvedValue({ id: 'o-1' });
    prisma.review.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );

    await expect(
      crearServicio(prisma).create(USUARIO, {
        productId: PRODUCTO,
        rating: 4,
        comment: 'Otra vez',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('getEligibility no deja resenar dos veces', async () => {
    const prisma = crearPrisma();
    prisma.order.findFirst.mockResolvedValue({ id: 'o-1' });
    prisma.review.findUnique.mockResolvedValue({
      id: 'r-1',
      status: ReviewStatus.PENDING,
    });

    const r = await crearServicio(prisma).getEligibility(USUARIO, PRODUCTO);

    expect(r.hasPurchased).toBe(true);
    expect(r.alreadyReviewed).toBe(true);
    expect(r.canReview).toBe(false);
  });
});

describe('ReviewsService - nada se publica sin moderar', () => {
  it('no deja que el cliente elija el estado: nace PENDING', async () => {
    const prisma = crearPrisma();
    prisma.order.findFirst.mockResolvedValue({ id: 'o-1' });

    await crearServicio(prisma).create(USUARIO, {
      productId: PRODUCTO,
      rating: 5,
      comment: 'Excelente',
    });

    const data = prisma.review.create.mock.calls[0][0].data;
    // El servicio nunca escribe status: queda el default PENDING del esquema.
    expect(data.status).toBeUndefined();
  });

  it('la lista publica solo trae APPROVED', async () => {
    const prisma = crearPrisma();
    await crearServicio(prisma).findPublicByProduct(PRODUCTO);

    expect(prisma.review.findMany.mock.calls[0][0].where).toEqual({
      productId: PRODUCTO,
      status: ReviewStatus.APPROVED,
    });
  });

  it('usa el correo sin dominio si el cliente no tiene nombre', async () => {
    const prisma = crearPrisma();
    prisma.order.findFirst.mockResolvedValue({ id: 'o-1' });
    prisma.user.findUnique.mockResolvedValue({
      name: null,
      email: 'sergio@gmail.com',
    });

    await crearServicio(prisma).create(USUARIO, {
      productId: PRODUCTO,
      rating: 5,
      comment: 'Bueno',
    });

    // Nunca el correo completo: la resena es publica.
    expect(prisma.review.create.mock.calls[0][0].data.authorName).toBe('sergio');
  });
});

describe('ReviewsService - promedio del producto', () => {
  it('promedia solo las resenas aprobadas', async () => {
    const prisma = crearPrisma();
    prisma.review.findUnique.mockResolvedValue({
      id: 'r-1',
      productId: PRODUCTO,
    });
    prisma.tx.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.333333 },
      _count: { rating: 3 },
    });

    await crearServicio(prisma).moderate('r-1', {
      status: ReviewStatus.APPROVED,
    });

    expect(prisma.tx.review.aggregate.mock.calls[0][0].where.status).toBe(
      ReviewStatus.APPROVED,
    );
    expect(prisma.tx.product.update.mock.calls[0][0].data).toEqual({
      ratingAverage: 4.33, // redondeado a 2 decimales
      ratingCount: 3,
    });
  });

  it('vuelve a 0 cuando no queda ninguna aprobada', async () => {
    const prisma = crearPrisma();
    prisma.review.findUnique.mockResolvedValue({
      id: 'r-1',
      productId: PRODUCTO,
    });
    prisma.tx.review.aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    });

    await crearServicio(prisma).moderate('r-1', {
      status: ReviewStatus.REJECTED,
    });

    expect(prisma.tx.product.update.mock.calls[0][0].data).toEqual({
      ratingAverage: 0,
      ratingCount: 0,
    });
  });

  it('recalcula dentro de la misma transaccion que modera', async () => {
    const prisma = crearPrisma();
    prisma.review.findUnique.mockResolvedValue({
      id: 'r-1',
      productId: PRODUCTO,
    });

    await crearServicio(prisma).moderate('r-1', {
      status: ReviewStatus.APPROVED,
    });

    // Si el recalculo quedara fuera, existiria un instante con el promedio sin
    // cuadrar con lo publicado.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.tx.product.update).toHaveBeenCalled();
  });

  it('invalida la cache de la tienda al moderar', async () => {
    const prisma = crearPrisma();
    prisma.review.findUnique.mockResolvedValue({
      id: 'r-1',
      productId: PRODUCTO,
    });
    const revalidation = { revalidate: jest.fn() };
    const servicio = crearServicio(prisma, revalidation);

    await servicio.moderate('r-1', { status: ReviewStatus.APPROVED });

    // Sin esto la resena tardaria hasta 5 minutos en verse en la tienda.
    expect(revalidation.revalidate).toHaveBeenCalledWith([
      'products',
      'product-monstera',
    ]);
  });

  it('borrar una resena tambien recalcula', async () => {
    const prisma = crearPrisma();
    prisma.review.findUnique.mockResolvedValue({
      id: 'r-1',
      productId: PRODUCTO,
    });

    await crearServicio(prisma).remove('r-1');

    expect(prisma.tx.review.delete).toHaveBeenCalled();
    expect(prisma.tx.product.update).toHaveBeenCalled();
  });
});
