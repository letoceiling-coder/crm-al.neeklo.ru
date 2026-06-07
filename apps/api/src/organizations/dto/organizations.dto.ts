import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;
}
