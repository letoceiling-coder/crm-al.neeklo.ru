import {
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import {
  CrmClientStatus,
  CrmPipelineStage,
  CrmTaskStatus,
  CrmTaskPriority,
  CrmEntityType,
} from '@prisma/client';

export class CreateCrmClientDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(CrmClientStatus)
  status?: CrmClientStatus;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class UpdateCrmClientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(CrmClientStatus)
  status?: CrmClientStatus;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class CreateCrmLeadDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(CrmPipelineStage)
  status?: CrmPipelineStage;

  @IsOptional()
  @IsInt()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpdateCrmLeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(CrmPipelineStage)
  status?: CrmPipelineStage;

  @IsOptional()
  @IsInt()
  score?: number;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class CreateCrmDealDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(CrmPipelineStage)
  status?: CrmPipelineStage;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;
}

export class UpdateCrmDealDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(CrmPipelineStage)
  status?: CrmPipelineStage;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;
}

export class CreateCrmTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CrmTaskStatus)
  status?: CrmTaskStatus;

  @IsOptional()
  @IsEnum(CrmTaskPriority)
  priority?: CrmTaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class UpdateCrmTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CrmTaskStatus)
  status?: CrmTaskStatus;

  @IsOptional()
  @IsEnum(CrmTaskPriority)
  priority?: CrmTaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class CreateCrmNoteDto {
  @IsEnum(CrmEntityType)
  entityType!: CrmEntityType;

  @IsString()
  entityId!: string;

  @IsString()
  content!: string;
}

export class ListCrmNotesQueryDto {
  @IsEnum(CrmEntityType)
  entityType!: CrmEntityType;

  @IsString()
  entityId!: string;
}

export class ListCrmActivitiesQueryDto {
  @IsEnum(CrmEntityType)
  entityType!: CrmEntityType;

  @IsString()
  entityId!: string;
}
