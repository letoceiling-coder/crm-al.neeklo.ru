import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsObject,
  IsBoolean,
  IsArray,
} from 'class-validator';
import {
  MemoryProfileEntityType,
  MemoryProfileStatus,
  MemoryEntryType,
  MemorySearchMode,
} from '@prisma/client';

export class CreateMemoryProfileDto {
  @IsEnum(MemoryProfileEntityType)
  entityType!: MemoryProfileEntityType;

  @IsString()
  entityId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class UpdateMemoryProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(MemoryProfileStatus)
  status?: MemoryProfileStatus;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class CreateMemoryEntryDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsEnum(MemoryEntryType)
  entryType?: MemoryEntryType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  importance?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class MemorySearchDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsString()
  profileId?: string;

  @IsOptional()
  @IsEnum(MemoryProfileEntityType)
  entityType?: MemoryProfileEntityType;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsEnum(MemorySearchMode)
  mode?: MemorySearchMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  assistantId?: string;

  @IsOptional()
  @IsBoolean()
  debug?: boolean;
}

export class SummarizeMemoryDto {
  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxEntries?: number;
}

export class GetOrCreateProfileDto {
  @IsEnum(MemoryProfileEntityType)
  entityType!: MemoryProfileEntityType;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class ListMemoryProfilesQueryDto {
  @IsOptional()
  @IsEnum(MemoryProfileEntityType)
  entityType?: MemoryProfileEntityType;
}

export class ListMemoryEntriesQueryDto {
  @IsOptional()
  @IsEnum(MemoryEntryType)
  entryType?: MemoryEntryType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
