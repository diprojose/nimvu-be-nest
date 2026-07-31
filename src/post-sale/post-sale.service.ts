import { Injectable, NotFoundException } from '@nestjs/common';
import { PostSaleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostSaleCaseDto } from './dto/create-post-sale-case.dto';
import { UpdatePostSaleCaseDto } from './dto/update-post-sale-case.dto';

const CASE_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, images: true } },
    },
  },
} as const;

/**
 * Casos de postventa (roturas, cambios, faltantes) sobre ordenes ya
 * entregadas. Por ahora es solo registro: no mueve inventario ni escribe en
 * contabilidad. Los campos de envio quedan modelados para poder activar eso
 * despues sin migrar de nuevo.
 */
@Injectable()
export class PostSaleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePostSaleCaseDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');

    const { items, orderId, status, ...rest } = dto;

    return this.prisma.postSaleCase.create({
      data: {
        ...rest,
        status,
        order: { connect: { id: orderId } },
        resolvedAt: status === PostSaleStatus.RESOLVED ? new Date() : undefined,
        items: items?.length
          ? {
              create: items.map((item) => ({
                productId: item.productId,
                variantName: item.variantName,
                fromVariantName: item.fromVariantName,
                quantity: item.quantity ?? 1,
                note: item.note,
              })),
            }
          : undefined,
      },
      include: CASE_INCLUDE,
    });
  }

  findAll(orderId?: string) {
    return this.prisma.postSaleCase.findMany({
      where: orderId ? { orderId } : undefined,
      include: CASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const found = await this.prisma.postSaleCase.findUnique({
      where: { id },
      include: CASE_INCLUDE,
    });
    if (!found) throw new NotFoundException('Caso de postventa no encontrado');
    return found;
  }

  async update(id: string, dto: UpdatePostSaleCaseDto) {
    const current = await this.findOne(id);
    const { items, status, ...rest } = dto;

    // resolvedAt se sella la primera vez que el caso pasa a RESOLVED y se
    // limpia si vuelve a abrirse.
    let resolvedAt: Date | null | undefined;
    if (status && status !== current.status) {
      resolvedAt = status === PostSaleStatus.RESOLVED ? new Date() : null;
    }

    return this.prisma.postSaleCase.update({
      where: { id },
      data: {
        ...rest,
        status,
        resolvedAt,
        // Si vienen items, reemplazan por completo a los existentes.
        items: items
          ? {
              deleteMany: {},
              create: items.map((item) => ({
                productId: item.productId,
                variantName: item.variantName,
                fromVariantName: item.fromVariantName,
                quantity: item.quantity ?? 1,
                note: item.note,
              })),
            }
          : undefined,
      },
      include: CASE_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.postSaleCase.delete({ where: { id } });
  }
}
