import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePostSaleCaseDto } from './create-post-sale-case.dto';

// El caso no se puede mover de orden una vez creado.
export class UpdatePostSaleCaseDto extends PartialType(
  OmitType(CreatePostSaleCaseDto, ['orderId'] as const),
) {}
