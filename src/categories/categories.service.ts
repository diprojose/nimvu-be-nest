import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) { }

  create(createCategoryDto: CreateCategoryDto) {
    const slug = this.slugify(createCategoryDto.slug || createCategoryDto.name);
    return this.prisma.category.create({
      data: {
        ...createCategoryDto,
        slug,
      },
    });
  }

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')     // Replace spaces with -
      .replace(/[^\w-]+/g, '')  // Remove all non-word chars
      .replace(/--+/g, '-');    // Replace multiple - with single -
  }

  findAll() {
    return this.prisma.category.findMany({
      include: { _count: { select: { products: true } } }, // Include product count
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    let slug = updateCategoryDto.slug;

    if (slug) {
      slug = this.slugify(slug);
    } else if (!category.slug) {
      slug = this.slugify(updateCategoryDto.name || category.name);
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...updateCategoryDto,
        ...(slug && { slug }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.category.delete({
      where: { id },
    });
  }
}
