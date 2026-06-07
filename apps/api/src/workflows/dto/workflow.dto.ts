import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  WorkflowStatus,
  WorkflowTriggerType,
  WorkflowStepType,
} from '@prisma/client';

export class WorkflowStepDto {
  @IsString()
  stepKey!: string;

  @IsEnum(WorkflowStepType)
  stepType!: WorkflowStepType;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  position!: number;
}

export class CreateWorkflowDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(WorkflowTriggerType)
  triggerType!: WorkflowTriggerType;

  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  scheduleCron?: string;

  @IsOptional()
  @IsString()
  scheduleTimezone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps?: WorkflowStepDto[];
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(WorkflowStatus)
  status?: WorkflowStatus;

  @IsOptional()
  @IsEnum(WorkflowTriggerType)
  triggerType?: WorkflowTriggerType;

  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  scheduleCron?: string;

  @IsOptional()
  @IsString()
  scheduleTimezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps?: WorkflowStepDto[];
}

export class RunWorkflowDto {
  @IsOptional()
  @IsObject()
  triggerData?: Record<string, unknown>;
}
