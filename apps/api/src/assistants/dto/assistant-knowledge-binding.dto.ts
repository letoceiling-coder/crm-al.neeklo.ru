import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AssistantSearchMode } from '@prisma/client';

export class UpsertKnowledgeBindingDto {
  @IsUUID()
  knowledgeBaseId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxChunks?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(32000)
  maxTokens?: number;

  @IsOptional()
  @IsEnum(AssistantSearchMode)
  searchMode?: AssistantSearchMode;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  keywordWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  vectorWeight?: number;
}

export class UpdateKnowledgeBindingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxChunks?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(32000)
  maxTokens?: number;

  @IsOptional()
  @IsEnum(AssistantSearchMode)
  searchMode?: AssistantSearchMode;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  keywordWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  vectorWeight?: number;
}

export class AssistantContextPreviewDto {
  @IsString()
  query!: string;
}

export class AssistantChatDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsBoolean()
  debug?: boolean;

  @IsOptional()
  model?: string;
}
