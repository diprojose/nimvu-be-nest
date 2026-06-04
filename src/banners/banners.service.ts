import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: { ...dto, universeId: dto.universeId || null },
    });
  }

  findAll(filter: {
    universeId?: string;
    universeSlug?: string;
    home?: boolean;
    activeOnly?: boolean;
  } = {}) {
    const where: any = {};
    if (filter.activeOnly) where.isActive = true;
    if (filter.home) {
      where.universeId = null;
    } else if (filter.universeId) {
      where.universeId = filter.universeId;
    } else if (filter.universeSlug) {
      where.universe = { slug: filter.universeSlug };
    }

    return this.prisma.banner.findMany({
      where,
      orderBy: { order: 'asc' },
      include: { universe: true },
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
      include: { universe: true },
    });
    if (!banner) throw new NotFoundException(`Banner #${id} not found`);
    return banner;
  }

  async update(id: string, dto: UpdateBannerDto) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException(`Banner #${id} not found`);

    const data: any = { ...dto };
    if (data.universeId === '') data.universeId = null;

    return this.prisma.banner.update({ where: { id }, data });
  }

  async remove(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException(`Banner #${id} not found`);
    return this.prisma.banner.delete({ where: { id } });
  }
}
