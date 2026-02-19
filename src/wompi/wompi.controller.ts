import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { WompiService } from './wompi.service';

@Controller('wompi')
export class WompiController {
  constructor(private readonly wompiService: WompiService) { }

  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    return this.wompiService.handleWebhook(body);
  }
}
