import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';import { KnowledgeSourceType, ParserMode } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateKnowledgeSourceDto {
  @IsString()
  @MinLength(1)
  knowledgeBaseId!: string;

  @IsEnum(KnowledgeSourceType)
  type!: KnowledgeSourceType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  sitemapUrl?: string;

  @IsOptional()
  @IsEnum(ParserMode)
  parserMode?: ParserMode;
}

export class UpdateKnowledgeSourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(ParserMode)
  parserMode?: ParserMode;
}

export class ListKnowledgeSourcesQueryDto {
  @IsString()
  @MinLength(1)
  knowledgeBaseId!: string;
}
