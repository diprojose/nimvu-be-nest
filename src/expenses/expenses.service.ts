import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        description: dto.description,
        amount: dto.amount,
        category: dto.category,
        date: new Date(dto.date),
        notes: dto.notes,
      },
    });
  }

  async findAll() {
    return this.prisma.expense.findMany({
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto) {
    await this.findOne(id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.expense.delete({ where: { id } });
  }
}
