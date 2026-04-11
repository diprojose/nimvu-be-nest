import { Module } from '@nestjs/common';
import { WompiService } from './wompi.service';
import { WompiController } from './wompi.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, ConfigModule, MailModule],
  controllers: [WompiController],
  providers: [WompiService],
})
export class WompiModule {}
