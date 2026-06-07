import { IsString, IsOptional, IsEnum, IsBoolean, IsObject, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentType, AgentStatus } from '@prisma/client';

export class CreateKeyAgentDto {
  @ApiProperty({ example: 'Legal Assistant' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'legal-assistant' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: AgentType })
  @IsOptional()
  @IsEnum(AgentType)
  agentType?: AgentType;

  @ApiPropertyOptional({ enum: AgentStatus })
  @IsOptional()
  @IsEnum(AgentStatus)
  status?: AgentStatus;

  @ApiPropertyOptional({ example: 'You are a helpful assistant for {{company_name}}.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  systemPrompt?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Clone defaults from template' })
  @IsOptional()
  @IsString()
  templateId?: string;
}

export class UpdateKeyAgentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: AgentType })
  @IsOptional()
  @IsEnum(AgentType)
  agentType?: AgentType;

  @ApiPropertyOptional({ enum: AgentStatus })
  @IsOptional()
  @IsEnum(AgentStatus)
  status?: AgentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  systemPrompt?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class ListAssistantsQueryDto {
  @ApiPropertyOptional({ enum: AgentType })
  @IsOptional()
  @IsEnum(AgentType)
  agentType?: AgentType;

  @ApiPropertyOptional({ enum: AgentStatus })
  @IsOptional()
  @IsEnum(AgentStatus)
  status?: AgentStatus;
}

export class ListTemplatesQueryDto {
  @ApiPropertyOptional({ enum: AgentType })
  @IsOptional()
  @IsEnum(AgentType)
  agentType?: AgentType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  marketplace?: boolean;
}
