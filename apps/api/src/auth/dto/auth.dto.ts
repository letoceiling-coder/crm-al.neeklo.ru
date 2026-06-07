import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  twoFaCode?: string;
}

export class Enable2FaDto {
  @IsString()
  code: string;
}

export class UpdateThemeDto {
  @IsString()
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
