import { IsString, IsOptional, IsNumber, IsDateString, IsObject } from 'class-validator';

export class CreateEnterpriseContractDto {
  @IsString()
  organizationId!: string;

  @IsString()
  contractNumber!: string;

  @IsString()
  slaLevel!: string;

  @IsOptional()
  @IsDateString()
  dpaSignedAt?: string;

  @IsOptional()
  @IsString()
  dpaDocumentUrl?: string;

  @IsOptional()
  @IsNumber()
  customPriceMonthlyRub?: number;

  @IsOptional()
  @IsObject()
  customLimits?: Record<string, number>;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEnterpriseContractDto {
  @IsOptional()
  @IsString()
  slaLevel?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
