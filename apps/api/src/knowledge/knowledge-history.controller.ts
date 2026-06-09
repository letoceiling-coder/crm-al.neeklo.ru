import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { KnowledgeHistoryService } from './knowledge-history.service';
import { KnowledgeBaseService } from './knowledge-base.service';

@ApiTags('Knowledge History')
@ApiBearerAuth()
@Controller('v1/knowledge-history')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeHistoryController {
  constructor(
    private readonly history: KnowledgeHistoryService,
    private readonly kb: KnowledgeBaseService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List history events for a knowledge base' })
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query('knowledgeBaseId') knowledgeBaseId: string,
    @Query('documentId') documentId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    await this.kb.assertOwned(knowledgeBaseId, tenant.organizationId);
    return this.history.list(tenant.organizationId, knowledgeBaseId, {
      documentId,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }
}
