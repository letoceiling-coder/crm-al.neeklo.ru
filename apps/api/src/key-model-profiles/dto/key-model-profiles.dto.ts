import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  ValidateNested,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ModelChainItemDto {
  @IsString()
  modelId: string;

  @IsOptional()
  priority?: number;
}

export class PricingItemDto {
  @IsString()
  modelId: string;

  @IsNumber()
  costPrice: number;

  @IsNumber()
  sellPrice: number;
}

export class CreateKeyModelProfileDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  pricePerMillionRub: number;

  @ValidateNested({ each: true })
  @Type(() => ModelChainItemDto)
  modelChain: ModelChainItemDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PricingItemDto)
  pricing?: PricingItemDto[];
}

export class UpdateKeyModelProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerMillionRub?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ModelChainItemDto)
  modelChain?: ModelChainItemDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PricingItemDto)
  pricing?: PricingItemDto[];
}

export enum ApiKeyRoutingModeDto {
  PROFILE = 'profile',
  CUSTOM = 'custom',
}
