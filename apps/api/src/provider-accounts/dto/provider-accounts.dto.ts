import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { AIProvider, ProviderAccountStatus } from '@prisma/client';

export class CreateProviderAccountDto {
  @IsEnum(AIProvider)
  provider!: AIProvider;

  @IsString()
  @MaxLength(128)
  name!: string;

  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateProviderAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsEnum(ProviderAccountStatus)
  status?: ProviderAccountStatus;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
