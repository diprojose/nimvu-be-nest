import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO del registro publico (POST /users).
 * No expone `role` ni `isB2BApproved` a proposito: con `whitelist: true` en el
 * ValidationPipe global, esos campos se descartan si alguien los manda, asi que
 * un registro publico siempre termina como USER sin aprobar.
 * Para crear usuarios con rol se usa POST /users/admin, que exige ADMIN.
 */
export class RegisterUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
