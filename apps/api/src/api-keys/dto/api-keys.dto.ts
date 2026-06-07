import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsNumber,
  IsEnum,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ApiKeyRoutingModeDto {
  PROFILE = 'profile',
  CUSTOM = 'custom',
}

export class ModelChainItemDto {
  @IsString()
  modelId: string;

  @IsInt()
  @Min(0)
  priority: number;
}

export class PricingItemDto {
  @IsString()
  modelId: string;

  @IsNumber()
  costPrice: number;

  @IsNumber()
  sellPrice: number;
}

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  balanceRub?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerMillionRub?: number;

  @IsOptional()
  @IsEnum(ApiKeyRoutingModeDto)
  routingMode?: ApiKeyRoutingModeDto;

  @IsOptional()
  @IsString()
  modelProfileId?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ModelChainItemDto)
  modelChain?: ModelChainItemDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PricingItemDto)
  pricing?: PricingItemDto[];
}

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDomains?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  balanceRub?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerMillionRub?: number;

  @IsOptional()
  @IsEnum(ApiKeyRoutingModeDto)
  routingMode?: ApiKeyRoutingModeDto;

  @IsOptional()
  @IsString()
  modelProfileId?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ModelChainItemDto)
  modelChain?: ModelChainItemDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PricingItemDto)
  pricing?: PricingItemDto[];
}

export class SetBalanceDto {
  @IsNumber()
  @Min(0)
  balanceRub: number;
}

export class TopUpApiKeyDto {
  @IsNumber()
  @Min(0.01)
  amountRub: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class TopUpQueryDto {
  @IsOptional()
  @IsString()
  apiKeyId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
