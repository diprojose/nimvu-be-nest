import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PostSaleService } from './post-sale.service';
import { CreatePostSaleCaseDto } from './dto/create-post-sale-case.dto';
import { UpdatePostSaleCaseDto } from './dto/update-post-sale-case.dto';
import { AdminOnly } from '../auth/admin-only.decorator';

// Informacion operativa interna: todo el controller es solo para admins.
@Controller('post-sale-cases')
@AdminOnly()
export class PostSaleController {
  constructor(private readonly postSaleService: PostSaleService) {}

  @Post()
  create(@Body() dto: CreatePostSaleCaseDto) {
    return this.postSaleService.create(dto);
  }

  @Get()
  findAll(@Query('orderId') orderId?: string) {
    return this.postSaleService.findAll(orderId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postSaleService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePostSaleCaseDto) {
    return this.postSaleService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.postSaleService.remove(id);
  }
}
