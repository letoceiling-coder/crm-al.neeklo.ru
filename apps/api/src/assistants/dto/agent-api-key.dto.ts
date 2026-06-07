import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  MinLength,
  MaxLength,
  ArrayUnique,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentApiKeyEnvironment, AgentApiKeyScope } from '@prisma/client';

export class CreateAgentApiKeyDto {
  @ApiProperty({ example: 'Production Key' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ description: 'Parent billing API key (agw_)' })
  @IsString()
  apiKeyId!: string;

  @ApiPropertyOptional({ enum: AgentApiKeyEnvironment, default: 'PRODUCTION' })
  @IsOptional()
  @IsEnum(AgentApiKeyEnvironment)
  environment?: AgentApiKeyEnvironment;

  @ApiPropertyOptional({
    enum: AgentApiKeyScope,
    isArray: true,
    default: ['CHAT', 'TOOLS_INVOKE', 'KB_READ', 'MEMORY_READ', 'MEMORY_WRITE'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(AgentApiKeyScope, { each: true })
  scopes?: AgentApiKeyScope[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class RotateAgentApiKeyDto {
  @ApiPropertyOptional({ example: 'Rotated Production Key' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}
