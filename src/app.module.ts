import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { AddressesModule } from './addresses/addresses.module';
import { CategoriesModule } from './categories/categories.module';
import { MailModule } from './mail/mail.module';
import { CollectionsModule } from './collections/collections.module';
import { DiscountsModule } from './discounts/discounts.module';
import { ShippingModule } from './shipping/shipping.module';

@Module({
  imports: [ProductsModule, PrismaModule, UsersModule, OrdersModule,
    AuthModule,
    FilesModule,
    AddressesModule,
    CategoriesModule,
    MailModule,
    CollectionsModule,
    DiscountsModule,
    ShippingModule
  ],
  controllers: [AppController],

  providers: [AppService],
})
export class AppModule { }
