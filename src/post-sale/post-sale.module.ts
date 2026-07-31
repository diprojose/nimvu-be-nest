import { Module } from '@nestjs/common';
import { PostSaleService } from './post-sale.service';
import { PostSaleController } from './post-sale.controller';

@Module({
  providers: [PostSaleService],
  controllers: [PostSaleController],
})
export class PostSaleModule {}
