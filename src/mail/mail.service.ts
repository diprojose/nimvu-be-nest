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

  async sendGuestWelcome(user: any, generatedPassword: string) {
    await this.mailerService.sendMail({
      to: user.email,
      subject: '¡Tu cuenta en Nimvu ha sido creada!',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="color: #000;">Bienvenido a Nimvu, ${user.name}!</h1>
          <p>Gracias por tu compra. Para que puedas hacer seguimiento de tu pedido y disfrutar de una experiencia más rápida en el futuro, hemos creado una cuenta para ti con los siguientes datos:</p>
          <br/>
          <p><strong>Usuario:</strong> ${user.email}</p>
          <p><strong>Contraseña provisional:</strong> ${generatedPassword}</p>
          <br/>
          <p>Te recomendamos <a href="https://www.somosnimvu.com/my-account">iniciar sesión</a> y cambiar esta contraseña lo antes posible.</p>
          <br/>
          <p>Saludos,</p>
          <p>El equipo de Nimvu</p>
        </div>
      `,
    });
  }

  async sendOrderConfirmation(user: any, order: any) {
    const addr = order.shippingAddress as any;
    const shippingCost = addr?.shippingCost || 0;
    const productsTotal = order.total - shippingCost;

    const itemRows = (order.items ?? [])
      .map((item: any) => {
        const productName = item.product?.name ?? 'Producto';
        const variantName = item.variant?.name ? ` (${item.variant.name})` : '';
        const subtotal = (item.price * item.quantity).toLocaleString('es-CO');
        const imageUrl = item.product?.images?.[0] || 'https://via.placeholder.com/60';
        return `
          <tr>
            <td style="padding:12px 8px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;">
              <img src="${imageUrl}" alt="${productName}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;"/>
              <span>${productName}${variantName}</span>
            </td>
            <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
            <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:right;">$${item.price.toLocaleString('es-CO')}</td>
            <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">$${subtotal}</td>
          </tr>`;
      })
      .join('');

    await this.mailerService.sendMail({
      to: user.email,
      subject: `Confirmación de Pedido #${order.id.slice(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
          <div style="background: #f9f9f9; padding: 30px 24px; text-align: center; border-bottom: 1px solid #eee;">
            <h1 style="color: #000; margin: 0; font-size: 24px;">¡Gracias por tu compra!</h1>
          </div>
          <div style="padding: 24px;">
            <p>Hola ${user.name},</p>
            <p>Hemos recibido tu pedido <strong>#${order.id}</strong> y lo estamos procesando.</p>
            
            <h2 style="font-size:16px; margin-top:24px; color:#555;">Resumen de tu pedido:</h2>
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
              <thead>
                <tr style="background:#f9f9f9;">
                  <th style="padding:8px; text-align:left; border-bottom:1px solid #ddd;">Producto</th>
                  <th style="padding:8px; text-align:center; border-bottom:1px solid #ddd;">Cant.</th>
                  <th style="padding:8px; text-align:right; border-bottom:1px solid #ddd;">Precio</th>
                  <th style="padding:8px; text-align:right; border-bottom:1px solid #ddd;">Total</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <div style="width:100%; text-align:right; line-height: 1.6;">
              <p style="margin:4px 0; color:#555;">Subtotal productos: $${productsTotal.toLocaleString('es-CO')}</p>
              <p style="margin:4px 0; color:#555;">Envío: $${shippingCost.toLocaleString('es-CO')}</p>
              <h3 style="margin:12px 0 0 0; font-size:18px;">Total Pagado: $${order.total.toLocaleString('es-CO')}</h3>
            </div>

            <hr style="margin:24px 0; border:none; border-top:1px solid #ddd;" />
            <p style="margin-bottom:8px;">Te notificaremos en cuanto tu pedido sea enviado.</p>
            <p style="margin:0; font-weight:bold;">Gracias por elegir Nimvu.</p>
          </div>
        </div>
      `,
    });
  }

  async sendPasswordReset(user: any, resetUrl: string) {
    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Restablecer tu contraseña - Nimvu',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: #000; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 22px; letter-spacing: 2px;">NIMVU</h1>
          </div>
          <div style="background: #f9f9f9; padding: 32px 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #000; font-size: 20px; margin-top: 0;">¿Olvidaste tu contraseña?</h2>
            <p style="margin-bottom: 8px;">Hola${user.name ? ` ${user.name}` : ''},</p>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón de abajo para crear una nueva contraseña.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}"
                 style="background: #000; color: #fff; padding: 14px 36px; text-decoration: none; font-weight: bold; letter-spacing: 2px; font-size: 12px; text-transform: uppercase; display: inline-block;">
                Restablecer contraseña
              </a>
            </div>
            <p style="color: #888; font-size: 13px;">Este enlace expirará en <strong>1 hora</strong>. Si no solicitaste el cambio de contraseña, puedes ignorar este correo con tranquilidad.</p>
            <hr style="margin: 24px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #aaa; font-size: 12px; margin: 0;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
              <a href="${resetUrl}" style="color: #666; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
        </div>
      `,
    });
  }

  async sendAbandonedCartEmail(user: any, order: any) {
    const itemRows = (order.items ?? [])
      .map((item: any) => {
        const productName = item.product?.name ?? 'Producto';
        const variantName = item.variant?.name ? ` (${item.variant.name})` : '';
        const imageUrl = item.product?.images?.[0] || 'https://via.placeholder.com/60';
        return `
          <tr>
            <td style="padding:10px 8px;border-bottom:1px solid #eee;">
              <div style="display:flex;align-items:center;gap:10px;">
                <img src="${imageUrl}" alt="${productName}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;"/>
                <span style="font-size:14px;">${productName}${variantName} x${item.quantity}</span>
              </div>
            </td>
            <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">
              $${(item.price * item.quantity).toLocaleString('es-CO')}
            </td>
          </tr>`;
      })
      .join('');

    await this.mailerService.sendMail({
      to: user.email,
      subject: '¿Olvidaste completar tu compra? 🛍️',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
          <div style="background: #000; padding: 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px; letter-spacing: 2px;">NIMVU</h1>
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="margin-top: 0; font-size: 20px;">Hola${user.name ? ` ${user.name.split(' ')[0]}` : ''}, dejaste algo pendiente</h2>
            <p style="color: #555; line-height: 1.6;">Notamos que iniciaste una compra pero no llegaste a completarla. Tus productos todavía te esperan:</p>

            <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
              <tbody>${itemRows}</tbody>
            </table>

            <div style="text-align: right; padding: 8px 0 24px 0; font-size: 18px; font-weight: bold;">
              Total: $${order.total.toLocaleString('es-CO')}
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="https://www.somosnimvu.com"
                 style="background: #000; color: #fff; padding: 14px 40px; text-decoration: none; font-weight: bold; letter-spacing: 1px; font-size: 13px; text-transform: uppercase; display: inline-block; border-radius: 2px;">
                Completar mi compra
              </a>
            </div>

            <p style="color: #888; font-size: 13px; text-align: center; margin-top: 24px;">
              Si ya completaste tu compra o decidiste no continuar, ignora este mensaje.
            </p>
          </div>
        </div>
      `,
    });
  }

  async sendAdminOrderAlert(user: any, order: any) {
    const adminEmail = process.env.MAIL_ADMIN || 'admin@nimvu.com';

    // Parse shippingAddress (stored as JSON)
    const addr = order.shippingAddress as any;
    const shippingCost = addr?.shippingCost || 0;
    const productsTotal = order.total - shippingCost;

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
        const imageUrl = item.product?.images?.[0] || 'https://via.placeholder.com/60';
        return `
          <tr>
            <td style="padding:12px 8px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;">
              <img src="${imageUrl}" alt="${productName}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"/>
              <span>${productName}${variantName}</span>
            </td>
            <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
            <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:right;">$${item.price.toLocaleString('es-CO')}</td>
            <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:right;">$${subtotal}</td>
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

            <div style="text-align:right; line-height:1.6; font-size:15px;">
              <div style="color:#666;">Subtotal: $${productsTotal.toLocaleString('es-CO')}</div>
              <div style="color:#666; margin-bottom:8px;">Envío: $${shippingCost.toLocaleString('es-CO')}</div>
              <div style="font-size:18px; font-weight:bold;">
                Total: $${order.total.toLocaleString('es-CO')}
              </div>
            </div>

            <hr style="margin:24px 0; border:none; border-top:1px solid #ddd;" />
            <p style="color:#888; font-size:12px; margin:0;">ID Pedido: ${order.id}</p>
          </div>
        </div>
      `,
    });
  }
}
