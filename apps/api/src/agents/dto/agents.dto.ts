import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AgentModelChainDto {
  @IsString()
  modelId: string;

  @IsNumber()
  @Min(0)
  priority: number;
}

export class AgentToolDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateAgentDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsString()
  systemPrompt: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxContext?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ValidateNested({ each: true })
  @Type(() => AgentModelChainDto)
  modelChain: AgentModelChainDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AgentToolDto)
  tools?: AgentToolDto[];
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxContext?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AgentModelChainDto)
  modelChain?: AgentModelChainDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AgentToolDto)
  tools?: AgentToolDto[];
}
