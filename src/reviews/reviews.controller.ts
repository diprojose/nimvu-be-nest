import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReviewStatus } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { AdminOnly } from '../auth/admin-only.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Resenas publicadas de un producto. Publico: es lo que se pinta en la ficha.
   * Solo devuelve APPROVED, nunca lo pendiente de moderar.
   */
  @Get('product/:productId')
  findByProduct(
    @Param('productId') productId: string,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
  ) {
    return this.reviewsService.findPublicByProduct(
      productId,
      take ?? 20,
      skip ?? 0,
    );
  }

  /**
   * Si el cliente puede resenar este producto. La tienda lo consulta para
   * decidir si muestra el formulario en vez de ofrecerlo y luego rechazarlo.
   */
  @Get('eligibility')
  @UseGuards(AuthGuard('jwt'))
  eligibility(@Query('productId') productId: string, @Request() req) {
    return this.reviewsService.getEligibility(req.user.userId, productId);
  }

  /** El autor sale del JWT, nunca del body. */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateReviewDto, @Request() req) {
    return this.reviewsService.create(req.user.userId, dto);
  }

  // ── Moderacion ───────────────────────────────────────────────────────────

  @Get()
  @AdminOnly()
  findAllForAdmin(@Query('status') status?: ReviewStatus) {
    return this.reviewsService.findAllForAdmin(status);
  }

  @Patch(':id')
  @AdminOnly()
  moderate(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.reviewsService.moderate(id, dto);
  }

  @Delete(':id')
  @AdminOnly()
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
