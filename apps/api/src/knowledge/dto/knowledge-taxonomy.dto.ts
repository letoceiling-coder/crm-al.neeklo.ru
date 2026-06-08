import { IsArray, IsOptional, IsString, MaxLength, MinLength, IsInt, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
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
  @IsString()
  @MinLength(1)
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
  @IsString()
  @MinLength(1)
  knowledgeBaseId!: string;

  @IsString()
  @MinLength(1)
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
  @IsString()
  @MinLength(1)
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
  @IsString()
  @MinLength(1)
  knowledgeBaseId!: string;
}

export class AssignDocumentTagsDto {
  @IsArray()
  @IsString({ each: true })
  tagIds!: string[];
}
