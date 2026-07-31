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
import { AdminOnly } from '../auth/admin-only.decorator';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @Get()
  findAll(
    @Query('universeId') universeId?: string,
    @Query('universeSlug') universeSlug?: string,
    @Query('home') home?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.bannersService.findAll({
      universeId,
      universeSlug,
      home: home === 'true',
      activeOnly: activeOnly === 'true',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @Patch(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
