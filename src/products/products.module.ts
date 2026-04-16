import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { RevalidationService } from './revalidation.service';

@Module({
  imports: [ConfigModule],
  providers: [ProductsService, RevalidationService],
  controllers: [ProductsController],
})
export class ProductsModule {}
