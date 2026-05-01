import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { ExpenseCategory } from '@prisma/client';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsDateString()
  date: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
