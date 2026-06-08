import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { KnowledgeJobService } from './jobs/knowledge-job.service';
import { KnowledgeJobStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

class ListJobsQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  knowledgeBaseId?: string;

  @IsOptional()
  @IsEnum(KnowledgeJobStatus)
  status?: KnowledgeJobStatus;
}

@ApiTags('Knowledge Jobs')
@ApiBearerAuth()
@Controller('v1/knowledge-jobs')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeJobsController {
  constructor(private jobs: KnowledgeJobService) {}

  @Get()
  @ApiOperation({ summary: 'List knowledge ingestion jobs' })
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListJobsQueryDto) {
    return this.jobs.findAll(tenant, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job details' })
  getOne(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.jobs.findOne(tenant, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel queued/running job' })
  cancel(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.jobs.cancel(tenant, id);
  }
}
