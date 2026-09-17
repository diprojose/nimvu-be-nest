import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidationService } from '../common/revalidation.service';
import { ReviewTokenService } from './review-token.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';

/** Lo que la tienda necesita para pintar una resena publica. */
const PUBLIC_SELECT = {
  id: true,
  rating: true,
  comment: true,
  authorName: true,
  adminReply: true,
  createdAt: true,
} as const;

/** Vista del admin: ademas de la resena, contra que producto y quien la dejo. */
const ADMIN_INCLUDE = {
  product: { select: { id: true, name: true, slug: true, images: true } },
  user: { select: { id: true, email: true, name: true } },
} as const;

/**
 * Resenas de producto.
 *
 * Dos reglas sostienen todo el modulo:
 *
 * 1. Solo resena quien compro. Se exige una orden DELIVERED del mismo usuario
 *    que incluya el producto. Sin eso el sello de "Compra verificada" no
 *    significaria nada.
 * 2. Nada se publica sin moderar. Toda resena nace PENDING.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: RevalidationService,
    private readonly reviewToken: ReviewTokenService,
  ) {}

  /**
   * Orden entregada que le da derecho a este usuario a resenar el producto.
   * Devuelve null si no compro, o si compro pero aun no le ha llegado.
   */
  private findPurchaseOrder(userId: string, productId: string) {
    return this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.DELIVERED,
        items: { some: { productId } },
      },
      // La primera compra: es la que acredita mas antiguedad como cliente.
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
  }

  /**
   * Que puede hacer este usuario con este producto. La tienda lo usa para
   * decidir si muestra el formulario, y asi no ofrecerlo para luego rechazarlo.
   */
  async getEligibility(userId: string, productId: string) {
    const [order, existing] = await Promise.all([
      this.findPurchaseOrder(userId, productId),
      this.prisma.review.findUnique({
        where: { userId_productId: { userId, productId } },
        select: { id: true, rating: true, comment: true, status: true, createdAt: true },
      }),
    ]);

    return {
      hasPurchased: !!order,
      alreadyReviewed: !!existing,
      canReview: !!order && !existing,
      review: existing,
    };
  }

  async create(userId: string, dto: CreateReviewDto) {
    const order = await this.findPurchaseOrder(userId, dto.productId);
    if (!order) {
      throw new ForbiddenException(
        'Solo puedes resenar productos que ya recibiste.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    try {
      return await this.prisma.review.create({
        data: {
          productId: dto.productId,
          userId,
          orderId: order.id,
          rating: dto.rating,
          comment: dto.comment,
          // Sin nombre en el perfil se usa la parte local del correo, nunca el
          // correo completo: es una resena publica.
          authorName: user?.name?.trim() || user?.email?.split('@')[0] || 'Cliente',
          // status queda en PENDING por defecto: no se acepta del cliente.
        },
        select: { ...PUBLIC_SELECT, status: true },
      });
    } catch (err) {
      // El @@unique([userId, productId]) es la defensa real contra la resena
      // duplicada; getEligibility solo evita llegar hasta aqui.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Ya dejaste una resena de este producto.');
      }
      throw err;
    }
  }

  /**
   * Datos para pintar la pagina de resena a la que lleva el correo. Devuelve
   * `valid: false` en vez de lanzar: la pagina tiene que poder explicarle al
   * cliente que el enlace vencio, no reventar con un 500.
   */
  async getInvite(token: string) {
    const payload = this.reviewToken.verify(token);
    if (!payload) return { valid: false as const };

    const [order, product, existing] = await Promise.all([
      this.prisma.order.findFirst({
        where: {
          id: payload.orderId,
          status: OrderStatus.DELIVERED,
          items: { some: { productId: payload.productId } },
        },
        select: { id: true, user: { select: { name: true, email: true } } },
      }),
      this.prisma.product.findUnique({
        where: { id: payload.productId },
        select: { id: true, name: true, slug: true, images: true },
      }),
      this.prisma.review.findFirst({
        where: { orderId: payload.orderId, productId: payload.productId },
        select: { id: true, rating: true, status: true },
      }),
    ]);

    // La firma es valida pero la orden ya no califica (se cancelo, se revirtio
    // el estado, o el producto se borro).
    if (!order || !product) return { valid: false as const };

    return {
      valid: true as const,
      product,
      alreadyReviewed: !!existing,
      authorName: order.user?.name?.trim() || order.user?.email?.split('@')[0] || 'Cliente',
    };
  }

  /**
   * Crea la resena desde el enlace del correo, sin sesion iniciada.
   *
   * Tener el token prueba acceso al buzon al que se envio la compra, que es la
   * misma garantia que da el login. La orden se revalida igual contra la base:
   * el token dice a que compra apunta, no que esa compra siga calificando.
   */
  async createFromToken(token: string, dto: { rating: number; comment: string }) {
    const payload = this.reviewToken.verify(token);
    if (!payload) {
      throw new ForbiddenException('El enlace no es valido o ya vencio.');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: payload.orderId,
        status: OrderStatus.DELIVERED,
        items: { some: { productId: payload.productId } },
      },
      select: { id: true, userId: true, user: { select: { name: true, email: true } } },
    });
    if (!order) {
      throw new ForbiddenException('Esta compra ya no permite dejar resena.');
    }

    try {
      return await this.prisma.review.create({
        data: {
          productId: payload.productId,
          userId: order.userId,
          orderId: order.id,
          rating: dto.rating,
          comment: dto.comment,
          authorName:
            order.user?.name?.trim() || order.user?.email?.split('@')[0] || 'Cliente',
        },
        select: { ...PUBLIC_SELECT, status: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Ya dejaste una resena de este producto.');
      }
      throw err;
    }
  }

  /** Resenas publicadas de un producto. */
  async findPublicByProduct(productId: string, take = 20, skip = 0) {
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId, status: ReviewStatus.APPROVED },
        select: PUBLIC_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.review.count({
        where: { productId, status: ReviewStatus.APPROVED },
      }),
    ]);

    return { items, total };
  }

  /** Cola de moderacion. Las pendientes primero, que es lo que hay que trabajar. */
  findAllForAdmin(status?: ReviewStatus) {
    return this.prisma.review.findMany({
      where: status ? { status } : undefined,
      include: ADMIN_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async moderate(id: string, dto: ModerateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true, productId: true },
    });
    if (!review) throw new NotFoundException('Resena no encontrada');

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.review.update({
        where: { id },
        data: {
          status: dto.status,
          // Cadena vacia borra la respuesta; undefined la deja como estaba.
          adminReply: dto.adminReply === '' ? null : dto.adminReply,
        },
        include: ADMIN_INCLUDE,
      });
      await this.recalculateProductRating(tx, review.productId);
      return result;
    });

    await this.revalidateProduct(review.productId);
    return updated;
  }

  async remove(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true, productId: true },
    });
    if (!review) throw new NotFoundException('Resena no encontrada');

    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      await this.recalculateProductRating(tx, review.productId);
    });

    await this.revalidateProduct(review.productId);
    return { deleted: true };
  }

  /**
   * Reescribe ratingAverage/ratingCount del producto contando SOLO las resenas
   * aprobadas. Corre dentro de la transaccion que modera, para que no exista un
   * instante en que el promedio no cuadre con lo publicado.
   */
  private async recalculateProductRating(
    tx: Prisma.TransactionClient,
    productId: string,
  ) {
    const stats = await tx.review.aggregate({
      where: { productId, status: ReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const count = stats._count.rating;

    await tx.product.update({
      where: { id: productId },
      data: {
        // Sin resenas aprobadas vuelve a 0/0, no a null: la tienda decide con
        // ratingCount > 0 si pinta estrellas.
        ratingAverage: count > 0 ? Math.round((stats._avg.rating ?? 0) * 100) / 100 : 0,
        ratingCount: count,
      },
    });
  }

  /**
   * La tienda cachea los productos 300s por tags. Sin invalidar, una resena
   * recien aprobada tardaria hasta 5 minutos en verse.
   */
  private async revalidateProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true },
    });

    const tags = ['products'];
    if (product?.slug) tags.push(`product-${product.slug}`);
    await this.revalidation.revalidate(tags);
  }
}
