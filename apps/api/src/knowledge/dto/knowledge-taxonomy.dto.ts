import { IsOptional, IsString, IsUUID, MaxLength, MinLength, IsInt, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsUUID()
  knowledgeBaseId!: string;

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
  description?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateTopicDto {
  @IsUUID()
  knowledgeBaseId!: string;

  @IsUUID()
  categoryId!: string;

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
  description?: string;
}

export class UpdateTopicDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateTagDto {
  @IsUUID()
  knowledgeBaseId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  slug?: string;
}

export class ListTaxonomyQueryDto {
  @IsUUID()
  knowledgeBaseId!: string;
}

export class AssignDocumentTagsDto {
  @IsUUID(undefined, { each: true })
  tagIds!: string[];
}
