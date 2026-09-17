import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/** Un token caducado no sirve; 90 dias sobra para opinar sobre una compra. */
const TTL_DAYS = 90;

export interface ReviewInvitePayload {
  orderId: string;
  productId: string;
}

/**
 * Firma y verifica los enlaces de "deja tu resena" que van en el correo
 * post-entrega.
 *
 * Existe para que el cliente pueda resenar SIN iniciar sesion: tener el enlace
 * ya prueba que tiene acceso al buzon al que se envio la compra, que es la
 * misma garantia que da el login. Sin esto, resenar exigiria una contrasena que
 * los compradores invitados nunca usan, y practicamente no llegarian resenas.
 *
 * El token no se guarda en base de datos: va firmado y lleva dentro todo lo que
 * hace falta para validarlo.
 */
@Injectable()
export class ReviewTokenService {
  private readonly logger = new Logger(ReviewTokenService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Clave propia, derivada de JWT_SECRET en vez de reutilizarlo tal cual: si
   * este token se filtrara, no sirve para firmar sesiones. Deriva tambien evita
   * tener que configurar una variable de entorno nueva.
   */
  private key(): Buffer {
    const base = this.configService.get<string>('JWT_SECRET');
    if (!base) {
      // Sin secreto no se puede firmar nada; mejor fallar aqui que emitir
      // tokens que cualquiera podria falsificar.
      throw new Error('JWT_SECRET no esta configurado: no se pueden firmar enlaces de resena.');
    }
    return createHmac('sha256', base).update('review-invite').digest();
  }

  private sign(data: string): string {
    return createHmac('sha256', this.key()).update(data).digest('base64url');
  }

  /** Token para invitar a resenar `productId` comprado en `orderId`. */
  create({ orderId, productId }: ReviewInvitePayload): string {
    const expiresAt = Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000;
    const data = `${orderId}:${productId}:${expiresAt}`;
    return `${Buffer.from(data).toString('base64url')}.${this.sign(data)}`;
  }

  /**
   * Devuelve el contenido del token si la firma es valida y no ha caducado.
   * Null en cualquier otro caso: el llamador decide que mensaje mostrar.
   */
  verify(token: string): (ReviewInvitePayload & { expiresAt: number }) | null {
    if (!token || typeof token !== 'string') return null;

    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;

    let data: string;
    try {
      data = Buffer.from(encoded, 'base64url').toString();
    } catch {
      return null;
    }

    const expected = this.sign(data);
    // Comparacion en tiempo constante: una comparacion normal filtra, por el
    // tiempo que tarda, cuantos caracteres del principio acerto un atacante.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const [orderId, productId, expiresAtRaw] = data.split(':');
    if (!orderId || !productId || !expiresAtRaw) return null;

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

    return { orderId, productId, expiresAt };
  }

  /** URL de la pagina de resena en la tienda. */
  buildUrl(payload: ReviewInvitePayload): string | null {
    const storeUrl = this.configService.get<string>('STORE_URL');
    if (!storeUrl) {
      this.logger.warn('STORE_URL no configurado: no se puede armar el enlace de resena');
      return null;
    }
    return `${storeUrl.replace(/\/$/, '')}/resenar?token=${this.create(payload)}`;
  }
}
