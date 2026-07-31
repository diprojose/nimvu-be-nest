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
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateGuestOrderDto } from './dto/create-order.dto';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AuthGuard } from '@nestjs/passport';
import { AdminOnly } from '../auth/admin-only.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Post('guest')
  createGuest(@Body() createGuestOrderDto: CreateGuestOrderDto) {
    return this.ordersService.createGuestOrder(createGuestOrderDto);
  }

  @AdminOnly()
  @Post('manual')
  createManual(@Body() createManualOrderDto: CreateManualOrderDto) {
    return this.ordersService.createManualOrder(createManualOrderDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll(@Request() req) {
    const user = req.user;
    if (user.role === 'ADMIN') {
      return this.ordersService.findAll();
    }
    return this.ordersService.findAll(user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    const order = await this.ordersService.findOne(id);
    // Un usuario solo puede ver sus propias ordenes. Se responde 404 en vez de
    // 403 para no confirmar que el id existe.
    if (!order || (req.user.role !== 'ADMIN' && order.userId !== req.user.userId)) {
      throw new NotFoundException('Orden no encontrada');
    }
    return order;
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @AdminOnly()
  @Post(':id/send-recovery')
  sendRecoveryEmail(@Param('id') id: string) {
    return this.ordersService.sendRecoveryEmail(id);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
