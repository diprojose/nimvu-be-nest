import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) { }

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

  async sendAdminOrderAlert(order: any) {
    // Assuming admin email is in env or hardcoded for now
    const adminEmail = process.env.MAIL_ADMIN || 'admin@nimvu.com';
    await this.mailerService.sendMail({
      to: adminEmail,
      subject: `Nuevo Pedido #${order.id}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="color: #000;">Nuevo Pedido Recibido</h1>
          <p><strong>ID Pedido:</strong> ${order.id}</p>
          <p><strong>Total:</strong> $${order.total}</p>
          <p><strong>Usuario ID:</strong> ${order.userId}</p>
        </div>
      `,
    });
  }
}
