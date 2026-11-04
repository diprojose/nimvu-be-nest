import {
  Controller,
  Post,
  Body,
  Headers,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { WompiService } from './wompi.service';

@Controller('wompi')
export class WompiController {
  constructor(private readonly wompiService: WompiService) {}

  // Wompi exige un 200 exacto; el 201 que Nest pone por defecto en un POST
  // cuenta como entrega fallida y dispara reintentos.
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    return this.wompiService.handleWebhook(body);
  }
}
