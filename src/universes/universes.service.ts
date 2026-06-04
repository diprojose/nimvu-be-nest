import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUniverseDto } from './dto/create-universe.dto';
import { UpdateUniverseDto } from './dto/update-universe.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UniversesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateUniverseDto) {
    const slug = this.slugify(dto.slug || dto.name);
    return this.prisma.universe.create({
      data: { ...dto, slug },
    });
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-');
  }

  findAll(opts: { activeOnly?: boolean; isB2BContext?: boolean } = {}) {
    const { activeOnly = false, isB2BContext = false } = opts;
    return this.prisma.universe.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { order: 'asc' },
      include: {
        categories: {
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: {
                products: isB2BContext
                  ? { where: { isActive: true } }
                  : { where: { isB2BOnly: false, isActive: true } },
              },
            },
          },
        },
      },
    });
  }

  async findOne(idOrSlug: string, isB2BContext: boolean = false) {
    const universe = await this.prisma.universe.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        categories: {
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: {
                products: isB2BContext
                  ? { where: { isActive: true } }
                  : { where: { isB2BOnly: false, isActive: true } },
              },
            },
          },
        },
      },
    });
    if (!universe) {
      throw new NotFoundException(`Universe ${idOrSlug} not found`);
    }
    return universe;
  }

  async update(id: string, dto: UpdateUniverseDto) {
    const universe = await this.prisma.universe.findUnique({ where: { id } });
    if (!universe) {
      throw new NotFoundException(`Universe #${id} not found`);
    }
    const slug = dto.slug ? this.slugify(dto.slug) : undefined;
    return this.prisma.universe.update({
      where: { id },
      data: { ...dto, ...(slug && { slug }) },
    });
  }

  async remove(id: string) {
    const universe = await this.prisma.universe.findUnique({ where: { id } });
    if (!universe) {
      throw new NotFoundException(`Universe #${id} not found`);
    }
    return this.prisma.universe.delete({ where: { id } });
  }
}
