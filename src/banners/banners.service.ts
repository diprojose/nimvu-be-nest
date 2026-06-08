import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidationService } from '../common/revalidation.service';

const REVALIDATION_TAGS = ['banners'];

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: RevalidationService,
  ) {}

  async create(dto: CreateBannerDto) {
    const created = await this.prisma.banner.create({
      data: { ...dto, universeId: dto.universeId || null },
    });
    this.revalidation.revalidate(REVALIDATION_TAGS);
    return created;
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

    const updated = await this.prisma.banner.update({ where: { id }, data });
    this.revalidation.revalidate(REVALIDATION_TAGS);
    return updated;
  }

  async remove(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException(`Banner #${id} not found`);
    const removed = await this.prisma.banner.delete({ where: { id } });
    this.revalidation.revalidate(REVALIDATION_TAGS);
    return removed;
  }
}
