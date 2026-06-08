import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BillingPlanTier, OrganizationRole } from '@prisma/client';

export class ChangePlanDto {
  @IsEnum(BillingPlanTier)
  tier!: BillingPlanTier;
}

export class InviteMemberDto {
  @IsString()
  email!: string;

  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}

export class ExportQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  format?: 'csv' | 'xlsx' | 'pdf';
}
