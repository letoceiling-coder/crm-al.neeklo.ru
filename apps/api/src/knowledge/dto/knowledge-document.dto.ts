import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { KnowledgeDocumentFormat } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUrlDocumentDto {
  @IsUUID()
  knowledgeBaseId!: string;

  @IsUrl({ require_protocol: true })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsUUID()
  knowledgeSourceId?: string;
}

export class CreateManualDocumentDto {
  @IsUUID()
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
  @IsUUID()
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
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsUUID()
  topicId?: string | null;
}

export { KnowledgeDocumentFormat };
