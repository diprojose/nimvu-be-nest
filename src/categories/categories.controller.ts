import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createCategoryDto: CreateCategoryDto, @Request() req) {
    // Optional: Check if user is ADMIN
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  findAll(@Query('isB2B') isB2B?: string) {
    const isB2BContext = isB2B === 'true';
    return this.categoriesService.findAll(isB2BContext);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('isB2B') isB2B?: string) {
    const isB2BContext = isB2B === 'true';
    return this.categoriesService.findOne(id, isB2BContext);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
