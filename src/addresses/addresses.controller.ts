import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) { }

  @Post()
  create(@Request() req, @Body() createAddressDto: CreateAddressDto) {
    return this.addressesService.create(req.user.userId, createAddressDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.addressesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.addressesService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Request() req, @Body() updateAddressDto: UpdateAddressDto) {
    return this.addressesService.update(id, req.user.userId, updateAddressDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.addressesService.remove(id, req.user.userId);
  }
}
