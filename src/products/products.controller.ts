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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdminOnly } from '../auth/admin-only.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @AdminOnly()
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(
    @Query('isB2B') isB2B?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('universeSlug') universeSlug?: string,
    @Query('universeId') universeId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const isB2BContext = isB2B === 'true';
    const showInactive = includeInactive === 'true';
    return this.productsService.findAll(isB2BContext, showInactive, {
      universeSlug,
      universeId,
      categorySlug,
      categoryId,
    });
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.productsService.findOne(id, includeInactive === 'true');
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
