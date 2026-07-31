import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

/**
 * Exige JWT valido + rol ADMIN. Atajo para las rutas de escritura del admin.
 */
export const AdminOnly = () =>
  applyDecorators(UseGuards(AuthGuard('jwt'), RolesGuard), Roles(Role.ADMIN));
