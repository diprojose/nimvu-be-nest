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
import { UniversesService } from './universes.service';
import { CreateUniverseDto } from './dto/create-universe.dto';
import { UpdateUniverseDto } from './dto/update-universe.dto';

@Controller('universes')
export class UniversesController {
  constructor(private readonly universesService: UniversesService) {}

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateUniverseDto) {
    return this.universesService.create(dto);
  }

  @Get()
  findAll(
    @Query('activeOnly') activeOnly?: string,
    @Query('isB2B') isB2B?: string,
  ) {
    return this.universesService.findAll({
      activeOnly: activeOnly === 'true',
      isB2BContext: isB2B === 'true',
    });
  }

  @Get(':idOrSlug')
  findOne(
    @Param('idOrSlug') idOrSlug: string,
    @Query('isB2B') isB2B?: string,
  ) {
    return this.universesService.findOne(idOrSlug, isB2B === 'true');
  }

  @Patch(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateUniverseDto) {
    return this.universesService.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.universesService.remove(id);
  }
}
