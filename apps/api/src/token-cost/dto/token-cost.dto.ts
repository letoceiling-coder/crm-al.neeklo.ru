import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateTokenCostSnapshotDto {
  @IsString()
  provider!: string;

  @IsString()
  model!: string;

  @IsNumber()
  @Min(0)
  inputPrice!: number;

  @IsNumber()
  @Min(0)
  outputPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cachedInputPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cachedOutputPrice?: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
