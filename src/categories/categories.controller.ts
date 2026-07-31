import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AdminOnly } from '../auth/admin-only.decorator';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @AdminOnly()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  findAll(
    @Query('isB2B') isB2B?: string,
    @Query('universeId') universeId?: string,
    @Query('universeSlug') universeSlug?: string,
  ) {
    const isB2BContext = isB2B === 'true';
    return this.categoriesService.findAll(isB2BContext, {
      universeId,
      universeSlug,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('isB2B') isB2B?: string) {
    const isB2BContext = isB2B === 'true';
    return this.categoriesService.findOne(id, isB2BContext);
  }

  @Patch(':id')
  @AdminOnly()
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
