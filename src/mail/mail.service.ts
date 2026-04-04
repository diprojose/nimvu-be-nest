import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendUserConfirmation(user: any) {
    const url = `example.com/auth/confirm?token=${user.confirmationToken}`;

    await this.mailerService.sendMail({
      to: user.email,
      // from: '"Support Team" <support@example.com>', // override default from
      subject: 'Welcome to Nimvu! Confirm your Email',
      // template: './confirmation', // `.hbs` extension is appended automatically
      // context: { // ✏️ filling curly brackets with content
      //   name: user.name,
      //   url,
      // },
      html: `
        <h1>Welcome to Nimvu, ${user.name}!</h1>
        <p>We are thrilled to have you with us.</p>
        <p>Explore our unique collection of 3D printed decor.</p>
      `,
    });
  }

  async sendUserWelcome(user: any) {
    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Bienvenido a Nimvu',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="color: #000;">Bienvenido a Nimvu, ${user.name}!</h1>
          <p>Estamos encantados de que te unas a nuestra comunidad.</p>
          <p>En Nimvu, creemos que cada objeto cuenta una historia. Esperamos que encuentres piezas que resuenen contigo.</p>
          <br/>
          <p>Saludos,</p>
          <p>El equipo de Nimvu</p>
        </div>
      `,
    });
  }

  async sendOrderConfirmation(user: any, order: any) {
    await this.mailerService.sendMail({
      to: user.email,
      subject: `Confirmación de Pedido #${order.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="color: #000;">¡Gracias por tu compra!</h1>
          <p>Hola ${user.name},</p>
          <p>Hemos recibido tu pedido #${order.id} y lo estamos procesando.</p>
          <p><strong>Total:</strong> $${order.total}</p>
          <br/>
          <p>Te notificaremos cuando tu pedido sea enviado.</p>
          <br/>
          <p>Gracias por elegir Nimvu.</p>
        </div>
      `,
    });
  }

  async sendAdminOrderAlert(user: any, order: any) {
    const adminEmail = process.env.MAIL_ADMIN || 'admin@nimvu.com';

    // Parse shippingAddress (stored as JSON)
    const addr = order.shippingAddress as any;
    const addressLine = addr
      ? [addr.address_1, addr.address_2, addr.city, addr.province, addr.country]
          .filter(Boolean)
          .join(', ')
      : 'No especificada';
    const phone = addr?.phone || 'No especificado';

    // Build product rows
    const itemRows = (order.items ?? [])
      .map((item: any) => {
        const productName = item.product?.name ?? 'Producto';
        const variantName = item.variant?.name ? ` (${item.variant.name})` : '';
        const subtotal = (item.price * item.quantity).toLocaleString('es-CO');
        return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${productName}${variantName}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${item.price.toLocaleString('es-CO')}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${subtotal}</td>
          </tr>`;
      })
      .join('');

    await this.mailerService.sendMail({
      to: adminEmail,
      subject: `🛒 Nuevo Pedido #${order.id.slice(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: #000; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 20px;">🛒 Nuevo Pedido Recibido</h1>
          </div>

          <div style="background: #f9f9f9; padding: 24px; border: 1px solid #eee; border-top: none;">

            <h2 style="font-size:15px; color:#555; margin-top:0;">📋 Datos del Cliente</h2>
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
              <tr>
                <td style="padding:6px 0; font-weight:bold; width:140px;">Nombre:</td>
                <td style="padding:6px 0;">${user.name ?? '—'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-weight:bold;">Email:</td>
                <td style="padding:6px 0;">${user.email ?? '—'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-weight:bold;">Teléfono:</td>
                <td style="padding:6px 0;">${phone}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-weight:bold;">Dirección:</td>
                <td style="padding:6px 0;">${addressLine}</td>
              </tr>
            </table>

            <h2 style="font-size:15px; color:#555;">📦 Productos</h2>
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
              <thead>
                <tr style="background:#eee;">
                  <th style="padding:8px; text-align:left;">Producto</th>
                  <th style="padding:8px; text-align:center;">Cantidad</th>
                  <th style="padding:8px; text-align:right;">Precio unit.</th>
                  <th style="padding:8px; text-align:right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <div style="text-align:right; font-size:18px; font-weight:bold;">
              Total: $${order.total.toLocaleString('es-CO')}
            </div>

            <hr style="margin:24px 0; border:none; border-top:1px solid #ddd;" />
            <p style="color:#888; font-size:12px; margin:0;">ID Pedido: ${order.id}</p>
          </div>
        </div>
      `,
    });
  }
}
