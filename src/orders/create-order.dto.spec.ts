import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';

/**
 * Regresion: un pedido llego a produccion sin ciudad porque `shippingAddress`
 * viajaba como `object` sin validar. Estas pruebas cubren el rechazo y, sobre
 * todo, que el `whitelist: true` del ValidationPipe no borre campos del
 * snapshot de direccion que el servicio guarda en la orden.
 */
describe('CreateOrderDto - validacion de direccion de envio', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const meta = {
    type: 'body' as const,
    metatype: CreateOrderDto,
    data: '',
  };

  const direccionCompleta = {
    first_name: 'Sergio',
    last_name: 'Preciado',
    address_1: 'Cra 50b #64-43, t2 apto 1202',
    city: 'Bogota D.C.',
    province: 'Cundinamarca',
    postal_code: '111201',
    phone: '3008167471',
    country_code: 'CO',
    company: null,
    address_2: null,
  };

  const pedido = (shippingAddress: Record<string, unknown>) => ({
    shippingAddress,
    items: [{ productId: 'prod-1', quantity: 1 }],
    paymentMethod: 'WOMPI',
    shippingCost: 12000,
  });

  const transformar = (body: unknown) => pipe.transform(body, meta);

  it('acepta una direccion completa', async () => {
    await expect(transformar(pedido(direccionCompleta))).resolves.toBeDefined();
  });

  it('rechaza el pedido sin ciudad', async () => {
    const { city, ...sinCiudad } = direccionCompleta;
    await expect(transformar(pedido(sinCiudad))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza la ciudad vacia (el caso real que se colo)', async () => {
    await expect(
      transformar(pedido({ ...direccionCompleta, city: '' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza el pedido sin departamento', async () => {
    await expect(
      transformar(pedido({ ...direccionCompleta, province: '' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza la direccion vacia y el telefono vacio', async () => {
    await expect(
      transformar(pedido({ ...direccionCompleta, address_1: '   ' })),
    ).rejects.toThrow(BadRequestException);
    await expect(
      transformar(pedido({ ...direccionCompleta, phone: '' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('conserva los campos del snapshot que el servicio guarda', async () => {
    const resultado = (await transformar(
      pedido(direccionCompleta),
    )) as CreateOrderDto;

    // whitelist:true elimina cualquier propiedad no declarada en el DTO; si
    // alguna de estas desaparece, la orden se guarda con la direccion mutilada.
    expect(resultado.shippingAddress).toMatchObject({
      first_name: 'Sergio',
      last_name: 'Preciado',
      address_1: 'Cra 50b #64-43, t2 apto 1202',
      city: 'Bogota D.C.',
      province: 'Cundinamarca',
      postal_code: '111201',
      phone: '3008167471',
      country_code: 'CO',
    });
  });
});
