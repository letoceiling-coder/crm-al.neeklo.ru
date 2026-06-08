import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { KnowledgeDocumentFormat } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUrlDocumentDto {
  @IsString()
  @MinLength(1)
  knowledgeBaseId!: string;

  @IsUrl({ require_protocol: true })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  knowledgeSourceId?: string;
}

export class CreateManualDocumentDto {
  @IsString()
  @MinLength(1)
  knowledgeBaseId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsString()
  @MinLength(1)
  text!: string;
}

export class ListKnowledgeDocumentsQueryDto {
  @IsString()
  @MinLength(1)
  knowledgeBaseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateKnowledgeDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  topicId?: string | null;
}

export { KnowledgeDocumentFormat };
