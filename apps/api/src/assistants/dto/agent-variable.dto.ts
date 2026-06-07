import { IsString, IsOptional, MaxLength, MinLength, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgentVariableItemDto {
  @ApiProperty({ example: 'company_name' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key!: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MaxLength(10000)
  value!: string;
}

export class UpsertAgentVariablesDto {
  @ApiProperty({ type: [AgentVariableItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentVariableItemDto)
  variables!: AgentVariableItemDto[];
}

export class RenderPromptDto {
  @ApiPropertyOptional({ description: 'Override system prompt; defaults to assistant prompt' })
  @IsOptional()
  @IsString()
  prompt?: string;
}
