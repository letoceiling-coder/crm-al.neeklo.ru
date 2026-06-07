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
import { KnowledgeSourceService } from './knowledge-source.service';
import {
  CreateKnowledgeSourceDto,
  UpdateKnowledgeSourceDto,
  ListKnowledgeSourcesQueryDto,
} from './dto/knowledge-source.dto';

@ApiTags('Knowledge Sources')
@ApiBearerAuth()
@Controller('v1/knowledge-sources')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeSourcesController {
  constructor(private service: KnowledgeSourceService) {}

  @Get()
  @ApiOperation({ summary: 'List knowledge sources' })
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListKnowledgeSourcesQueryDto) {
    return this.service.findAll(tenant, query.knowledgeBaseId);
  }

  @Post()
  @ApiOperation({ summary: 'Create knowledge source (URL / Sitemap / Domain)' })
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateKnowledgeSourceDto) {
    return this.service.create(tenant, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get knowledge source' })
  getOne(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.findOne(tenant, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update knowledge source' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeSourceDto,
  ) {
    return this.service.update(tenant, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete knowledge source' })
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.remove(tenant, id);
  }

  @Post(':id/crawl')
  @ApiOperation({ summary: 'Trigger source crawl / re-parse' })
  crawl(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.triggerCrawl(tenant, id);
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Source health metrics' })
  health(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.getHealth(tenant, id);
  }
}
