import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { AdminOnly } from '../auth/admin-only.decorator';

@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) { }

  @Post()
  @AdminOnly()
  create(@Body() createDiscountDto: CreateDiscountDto) {
    return this.discountsService.create(createDiscountDto);
  }

  // Publica: la tienda valida el cupon que escribe el cliente en el checkout.
  // Debe ir antes de @Get(':id') para que 'validate' no se lea como un id.
  @Get('validate/:code')
  validateCoupon(@Param('code') code: string) {
    return this.discountsService.validateCoupon(code);
  }

  // Solo admin: el listado completo expone todos los codigos de cupon activos.
  @Get()
  @AdminOnly()
  findAll() {
    return this.discountsService.findAll();
  }

  @Get(':id')
  @AdminOnly()
  findOne(@Param('id') id: string) {
    return this.discountsService.findOne(id);
  }

  @Patch(':id')
  @AdminOnly()
  update(
    @Param('id') id: string,
    @Body() updateDiscountDto: UpdateDiscountDto,
  ) {
    return this.discountsService.update(id, updateDiscountDto);
  }

  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.discountsService.remove(id);
  }
}
