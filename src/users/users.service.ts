import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { OrderStatus, Role } from '@prisma/client';
import { MailService } from '../mail/mail.service';

/**
 * Campos que se pueden devolver por la API. Deja fuera `password` y los
 * `passwordReset*`, que nunca deben salir del backend.
 */
const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  companyName: true,
  taxId: true,
  isB2BApproved: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Pedidos que no representan una compra concretada. */
const UNPAID_ORDER_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CANCELLED];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) { }

  async create(createUserDto: CreateUserDto | RegisterUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('Este email ya está registrado. Intenta iniciar sesión.');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    // El rol solo llega por CreateUserDto (POST /users/admin). El registro
    // publico usa RegisterUserDto, que no tiene el campo, asi que cae en USER.
    const requestedRole = (createUserDto as CreateUserDto).role;
    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        role: (requestedRole as Role) || Role.USER, // Default to USER if not provided
      },
      select: PUBLIC_USER_SELECT,
    });

    // Send welcome email
    this.mailService.sendUserWelcome(user);

    return user;
  }

  /**
   * Lista para el admin. Además de los datos del usuario calcula cuántos
   * pedidos ha pagado de verdad (`paidOrdersCount`) y cuántos abandonó
   * (`unpaidOrdersCount`, PENDING o CANCELLED), para poder detectar a quien
   * se registró o intentó comprar y no concretó.
   */
  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        ...PUBLIC_USER_SELECT,
        addresses: true,
        orders: { select: { status: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map(({ orders, ...user }) => {
      const paid = orders.filter((o) => !UNPAID_ORDER_STATUSES.includes(o.status));
      const lastOrder = orders.reduce<Date | null>(
        (latest, o) => (!latest || o.createdAt > latest ? o.createdAt : latest),
        null,
      );
      return {
        ...user,
        paidOrdersCount: paid.length,
        unpaidOrdersCount: orders.length - paid.length,
        lastOrderAt: lastOrder,
      };
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        ...PUBLIC_USER_SELECT,
        addresses: true,
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        role: updateUserDto.role as Role,
      },
      select: PUBLIC_USER_SELECT,
    });
  }

  remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
  }

  async saveResetToken(email: string, token: string, expiry: Date) {
    return this.prisma.user.update({
      where: { email },
      data: {
        passwordResetToken: token,
        passwordResetExpiry: expiry,
      },
    });
  }

  async findByResetToken(token: string) {
    return this.prisma.user.findFirst({
      where: { passwordResetToken: token },
    });
  }

  async clearResetToken(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });
  }
}
