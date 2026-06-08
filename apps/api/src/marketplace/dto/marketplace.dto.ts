import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  MarketplaceAssetType,
  MarketplaceBillingType,
  MarketplacePackageStatus,
  MarketplacePackageType,
  MarketplaceVisibility,
} from '@prisma/client';
import { SEMVER_PATTERN } from '../marketplace.types';

export class ListMarketplacePackagesQueryDto {
  @IsOptional()
  @IsEnum(MarketplacePackageType)
  type?: MarketplacePackageType;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(MarketplaceVisibility)
  visibility?: MarketplaceVisibility;

  @IsOptional()
  @IsString()
  mine?: string;
}

export class CreateMarketplacePackageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsEnum(MarketplacePackageType)
  type!: MarketplacePackageType;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(MarketplaceVisibility)
  visibility?: MarketplaceVisibility;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  banner?: string;

  @IsObject()
  manifest!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Matches(SEMVER_PATTERN)
  version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  changelog?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(MarketplaceBillingType)
  billingType?: MarketplaceBillingType;
}

export class UpdateMarketplacePackageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(MarketplaceVisibility)
  visibility?: MarketplaceVisibility;

  @IsOptional()
  @IsEnum(MarketplacePackageStatus)
  status?: MarketplacePackageStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  banner?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(MarketplaceBillingType)
  billingType?: MarketplaceBillingType;
}

export class PublishMarketplaceVersionDto {
  @IsString()
  @Matches(SEMVER_PATTERN)
  version!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  changelog?: string;

  @IsObject()
  manifest!: Record<string, unknown>;
}

export class InstallMarketplacePackageDto {
  @IsString()
  @MinLength(1)
  packageId!: string;

  @IsOptional()
  @IsString()
  @Matches(SEMVER_PATTERN)
  version?: string;
}

export class CreateMarketplaceReviewDto {
  @IsString()
  @MinLength(1)
  packageId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class CreateMarketplaceAssetDto {
  @IsEnum(MarketplaceAssetType)
  type!: MarketplaceAssetType;

  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  sizeBytes?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class FeaturedMarketplaceQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
