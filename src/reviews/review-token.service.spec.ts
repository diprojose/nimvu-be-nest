import { ReviewTokenService } from './review-token.service';

/**
 * El token ES la credencial: reemplaza al login para quien llega desde el
 * correo post-entrega. Si se pudiera falsificar o apuntar a otro producto,
 * cualquiera podria resenar cualquier cosa.
 */
const config = (values: Record<string, string> = {}) =>
  ({
    get: (k: string) =>
      ({ JWT_SECRET: 'secreto-de-pruebas', STORE_URL: 'https://www.somosnimvu.com', ...values })[k],
  }) as any;

const ORDEN = 'order-1';
const PRODUCTO = 'prod-1';

describe('ReviewTokenService', () => {
  const servicio = () => new ReviewTokenService(config());

  it('acepta un token que el mismo genero', () => {
    const s = servicio();
    const payload = s.verify(s.create({ orderId: ORDEN, productId: PRODUCTO }));

    expect(payload?.orderId).toBe(ORDEN);
    expect(payload?.productId).toBe(PRODUCTO);
  });

  it('rechaza un token con la firma alterada', () => {
    const s = servicio();
    const token = s.create({ orderId: ORDEN, productId: PRODUCTO });
    const [data, sig] = token.split('.');

    // Cambiar un solo caracter de la firma ya lo invalida.
    const alterada = sig.slice(0, -1) + (sig.at(-1) === 'A' ? 'B' : 'A');
    expect(s.verify(`${data}.${alterada}`)).toBeNull();
  });

  it('rechaza si le cambian el producto al payload', () => {
    const s = servicio();
    const token = s.create({ orderId: ORDEN, productId: PRODUCTO });
    const sig = token.split('.')[1];

    // Este es el ataque que importa: apuntar la resena a otro producto.
    const otro = Buffer.from(`${ORDEN}:prod-999:${Date.now() + 100000}`).toString('base64url');
    expect(s.verify(`${otro}.${sig}`)).toBeNull();
  });

  it('rechaza un token firmado con otro secreto', () => {
    const ajeno = new ReviewTokenService(config({ JWT_SECRET: 'otro-secreto' }));
    const token = ajeno.create({ orderId: ORDEN, productId: PRODUCTO });

    expect(servicio().verify(token)).toBeNull();
  });

  it('rechaza un token vencido', () => {
    const s = servicio();
    const token = s.create({ orderId: ORDEN, productId: PRODUCTO });
    const payload = s.verify(token)!;

    // 91 dias despues: el TTL es de 90.
    jest.spyOn(Date, 'now').mockReturnValue(payload.expiresAt + 1);
    expect(s.verify(token)).toBeNull();
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('rechaza basura sin reventar', () => {
    const s = servicio();
    for (const malo of ['', 'sin-punto', 'a.b', '....', 'null']) {
      expect(s.verify(malo)).toBeNull();
    }
  });

  it('arma el enlace de la tienda apuntando a /resenar', () => {
    const url = servicio().buildUrl({ orderId: ORDEN, productId: PRODUCTO })!;

    expect(url.startsWith('https://www.somosnimvu.com/resenar?token=')).toBe(true);
  });

  it('no arma enlace si falta STORE_URL', () => {
    const sinUrl = new ReviewTokenService({ get: (k: string) => (k === 'JWT_SECRET' ? 'x' : undefined) } as any);

    expect(sinUrl.buildUrl({ orderId: ORDEN, productId: PRODUCTO })).toBeNull();
  });

  it('falla al firmar si no hay JWT_SECRET, en vez de emitir tokens falsificables', () => {
    const sinSecreto = new ReviewTokenService({ get: () => undefined } as any);

    expect(() => sinSecreto.create({ orderId: ORDEN, productId: PRODUCTO })).toThrow();
  });
});
