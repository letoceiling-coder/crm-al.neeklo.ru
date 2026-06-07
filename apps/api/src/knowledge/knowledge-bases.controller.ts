import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeQueueService } from './jobs/knowledge-queue.service';
import {
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
  ListKnowledgeBasesQueryDto,
} from './dto/knowledge-base.dto';

@ApiTags('Knowledge Bases')
@ApiBearerAuth()
@Controller('v1/knowledge-bases')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeBasesController {
  constructor(
    private service: KnowledgeBaseService,
    private queue: KnowledgeQueueService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List knowledge bases' })
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListKnowledgeBasesQueryDto) {
    return this.service.findAll(tenant, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create knowledge base' })
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateKnowledgeBaseDto) {
    return this.service.create(tenant, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get knowledge base with statistics' })
  getOne(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.findOne(tenant, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update knowledge base' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.service.update(tenant, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete knowledge base' })
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.remove(tenant, id);
  }

  @Post(':id/reembed')
  @ApiOperation({ summary: 'Re-embed entire knowledge base' })
  reembed(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.queue.enqueueReembed({
      organizationId: tenant.organizationId,
      knowledgeBaseId: id,
    });
  }
}
