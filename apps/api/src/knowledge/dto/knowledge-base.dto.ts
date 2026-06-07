import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { KnowledgeBaseStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateKnowledgeBaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(KnowledgeBaseStatus)
  status?: KnowledgeBaseStatus;

  @IsOptional()
  @IsUUID()
  embeddingProfileId?: string;
}

export class UpdateKnowledgeBaseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(KnowledgeBaseStatus)
  status?: KnowledgeBaseStatus;

  @IsOptional()
  @IsUUID()
  embeddingProfileId?: string;
}

export class ListKnowledgeBasesQueryDto {
  @ApiPropertyOptional({ enum: KnowledgeBaseStatus })
  @IsOptional()
  @IsEnum(KnowledgeBaseStatus)
  status?: KnowledgeBaseStatus;
}
