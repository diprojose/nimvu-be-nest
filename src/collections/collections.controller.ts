import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AuthGuard } from '@nestjs/passport'; // Assuming AuthGuard is used

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  // @UseGuards(AuthGuard('jwt')) // Uncomment if auth is required
  create(@Body() createCollectionDto: CreateCollectionDto) {
    return this.collectionsService.create(createCollectionDto);
  }

  @Get()
  findAll(@Query('isB2B') isB2B?: string) {
    const isB2BContext = isB2B === 'true';
    return this.collectionsService.findAll(isB2BContext);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string, @Query('isB2B') isB2B?: string) {
    const isB2BContext = isB2B === 'true';
    return this.collectionsService.findBySlug(slug, isB2BContext);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.collectionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(id, updateCollectionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.collectionsService.remove(id);
  }
}
