import { IsString, IsOptional, IsBoolean, IsInt, Min, IsArray, IsObject } from 'class-validator';
import { ToolInstanceStatus } from '@prisma/client';

export class CreateToolInstanceDto {
  @IsString()
  toolDefinitionSlug!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  secret?: string;
}

export class UpdateToolInstanceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  status?: ToolInstanceStatus;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  secret?: string;
}

export class SetToolSecretDto {
  @IsString()
  secret!: string;

  @IsOptional()
  @IsString()
  key?: string;
}

export class ExecuteToolDto {
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  action?: string;
}

export class UpsertToolBindingDto {
  @IsString()
  toolInstanceId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedActions?: string[];
}

export class UpdateToolBindingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedActions?: string[];
}
