import { Module } from '@nestjs/common';
import { UniversesService } from './universes.service';
import { UniversesController } from './universes.controller';

@Module({
  controllers: [UniversesController],
  providers: [UniversesService],
})
export class UniversesModule {}
