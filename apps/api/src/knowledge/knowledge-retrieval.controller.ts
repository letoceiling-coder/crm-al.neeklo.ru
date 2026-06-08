import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { RetrievalService } from './search/retrieval.service';
import { IsOptional, IsString, IsInt, Min, Max, MinLength } from 'class-validator';

class RetrievalQueryDto {
  @IsString()
  @MinLength(1)
  knowledgeBaseId!: string;

  @IsString()
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  profileId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  topicId?: string;
}

@ApiTags('Knowledge Retrieval')
@ApiBearerAuth()
@Controller('v1/knowledge-retrieval')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeRetrievalController {
  constructor(private retrieval: RetrievalService) {}

  @Post('keyword')
  @ApiOperation({ summary: 'Keyword search (no RAG generation)' })
  keyword(@CurrentTenant() tenant: TenantContext, @Body() dto: RetrievalQueryDto) {
    return this.retrieval.searchByKeyword(
      tenant,
      dto.knowledgeBaseId,
      dto.query,
      dto.limit ?? 20,
      { categoryId: dto.categoryId, topicId: dto.topicId },
    );
  }

  @Post('vector')
  @ApiOperation({ summary: 'Vector search foundation' })
  vector(@CurrentTenant() tenant: TenantContext, @Body() dto: RetrievalQueryDto) {
    return this.retrieval.searchByVector(
      tenant,
      dto.knowledgeBaseId,
      dto.query,
      dto.limit ?? 20,
      dto.profileId,
      { categoryId: dto.categoryId, topicId: dto.topicId },
    );
  }

  @Post('hybrid')
  @ApiOperation({ summary: 'Hybrid search foundation (RRF)' })
  hybrid(@CurrentTenant() tenant: TenantContext, @Body() dto: RetrievalQueryDto) {
    return this.retrieval.hybridSearch(
      tenant,
      dto.knowledgeBaseId,
      dto.query,
      dto.limit ?? 20,
      dto.profileId,
      { categoryId: dto.categoryId, topicId: dto.topicId },
    );
  }
}
