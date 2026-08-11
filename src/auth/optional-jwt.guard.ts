import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Para rutas publicas que igual quieren saber quien es el usuario si viene
 * autenticado. A diferencia de AuthGuard('jwt'), un token ausente o invalido
 * deja pasar la peticion con req.user en undefined en vez de responder 401.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    return user || undefined;
  }
}
