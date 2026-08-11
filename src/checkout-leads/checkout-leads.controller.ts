import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CheckoutLeadsService } from './checkout-leads.service';
import { UpsertCheckoutLeadDto } from './dto/upsert-checkout-lead.dto';
import { UpdateCheckoutLeadDto } from './dto/update-checkout-lead.dto';
import { AdminOnly } from '../auth/admin-only.decorator';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';

@Controller('checkout-leads')
export class CheckoutLeadsController {
  constructor(private readonly checkoutLeadsService: CheckoutLeadsService) {}

  /**
   * Unico endpoint publico: lo llama el checkout de la tienda mientras el
   * cliente todavia no se ha autenticado. Responde 204 porque el navegador lo
   * dispara en segundo plano y no debe hacer nada con la respuesta.
   */
  @UseGuards(OptionalJwtGuard)
  @Post()
  @HttpCode(204)
  async upsert(@Body() dto: UpsertCheckoutLeadDto, @Request() req) {
    await this.checkoutLeadsService.upsert(dto, req.user?.userId);
  }

  @AdminOnly()
  @Get()
  findAll(@Query('includeConverted') includeConverted?: string) {
    return this.checkoutLeadsService.findAll(includeConverted === 'true');
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCheckoutLeadDto) {
    return this.checkoutLeadsService.update(id, dto);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.checkoutLeadsService.remove(id);
  }
}
