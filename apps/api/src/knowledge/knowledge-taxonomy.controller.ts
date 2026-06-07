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
import { KnowledgeTaxonomyService } from './knowledge-taxonomy.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateTopicDto,
  UpdateTopicDto,
  CreateTagDto,
  ListTaxonomyQueryDto,
  AssignDocumentTagsDto,
} from './dto/knowledge-taxonomy.dto';

@ApiTags('Knowledge Categories')
@ApiBearerAuth()
@Controller('v1/knowledge-categories')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeCategoriesController {
  constructor(private taxonomy: KnowledgeTaxonomyService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListTaxonomyQueryDto) {
    return this.taxonomy.listCategories(tenant, query.knowledgeBaseId);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateCategoryDto) {
    return this.taxonomy.createCategory(tenant, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.taxonomy.updateCategory(tenant, id, dto);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.taxonomy.removeCategory(tenant, id);
  }
}

@ApiTags('Knowledge Topics')
@ApiBearerAuth()
@Controller('v1/knowledge-topics')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeTopicsController {
  constructor(private taxonomy: KnowledgeTaxonomyService) {}

  @Get()
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListTaxonomyQueryDto,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.taxonomy.listTopics(tenant, query.knowledgeBaseId, categoryId);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateTopicDto) {
    return this.taxonomy.createTopic(tenant, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateTopicDto,
  ) {
    return this.taxonomy.updateTopic(tenant, id, dto);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.taxonomy.removeTopic(tenant, id);
  }
}

@ApiTags('Knowledge Tags')
@ApiBearerAuth()
@Controller('v1/knowledge-tags')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeTagsController {
  constructor(private taxonomy: KnowledgeTaxonomyService) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListTaxonomyQueryDto) {
    return this.taxonomy.listTags(tenant, query.knowledgeBaseId);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateTagDto) {
    return this.taxonomy.createTag(tenant, dto);
  }

  @Delete(':id')
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.taxonomy.removeTag(tenant, id);
  }

  @Post('assign/:documentId')
  @ApiOperation({ summary: 'Assign tags to document' })
  assign(
    @CurrentTenant() tenant: TenantContext,
    @Param('documentId') documentId: string,
    @Body() dto: AssignDocumentTagsDto,
  ) {
    return this.taxonomy.assignTags(tenant, documentId, dto);
  }
}
