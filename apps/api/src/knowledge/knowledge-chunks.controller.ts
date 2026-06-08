import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { KnowledgeChunkService } from './knowledge-chunk.service';
import { IsOptional, IsString, MinLength } from 'class-validator';

class ListChunksQuery {
  @IsString()
  @MinLength(1)
  knowledgeBaseId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  documentId?: string;
}

@ApiTags('Knowledge Chunks')
@ApiBearerAuth()
@Controller('v1/knowledge-chunks')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeChunksController {
  constructor(private service: KnowledgeChunkService) {}

  @Get()
  @ApiOperation({ summary: 'List chunks for knowledge base' })
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListChunksQuery) {
    return this.service.findAll(tenant, query);
  }
}

@ApiTags('Knowledge Embeddings')
@ApiBearerAuth()
@Controller('v1/knowledge-embeddings')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeEmbeddingsController {
  constructor(private chunks: KnowledgeChunkService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Embedding stats per knowledge base' })
  summary(@CurrentTenant() tenant: TenantContext, @Query('knowledgeBaseId') knowledgeBaseId: string) {
    return this.chunks.getSummary(tenant, knowledgeBaseId);
  }
}
