import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // Eliminamos await this.$connect() para que Prisma use "lazy connections"
    // lo cual recupera mejor las conexiones cuando un proxy (como Supabase) las corta por inactividad.
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
