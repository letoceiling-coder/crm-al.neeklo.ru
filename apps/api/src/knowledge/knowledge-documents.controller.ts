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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { KnowledgeDocumentService } from './knowledge-document.service';
import {
  CreateUrlDocumentDto,
  CreateManualDocumentDto,
  ListKnowledgeDocumentsQueryDto,
  UpdateKnowledgeDocumentDto,
} from './dto/knowledge-document.dto';

@ApiTags('Knowledge Documents')
@ApiBearerAuth()
@Controller('v1/knowledge-documents')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class KnowledgeDocumentsController {
  constructor(private service: KnowledgeDocumentService) {}

  @Get()
  @ApiOperation({ summary: 'List documents in knowledge base' })
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListKnowledgeDocumentsQueryDto) {
    return this.service.findAll(tenant, query.knowledgeBaseId, query.status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document with versions' })
  getOne(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.findOne(tenant, id);
  }

  @Post('url')
  @ApiOperation({ summary: 'Ingest document from URL via parser' })
  createFromUrl(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateUrlDocumentDto) {
    return this.service.createFromUrl(tenant, dto);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Create document from manual text' })
  createManual(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateManualDocumentDto) {
    return this.service.createFromManual(tenant, dto);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload file (PDF, DOCX, TXT, MD, ZIP) — returns jobId' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body('knowledgeBaseId') knowledgeBaseId: string,
    @Body('title') title?: string,
  ) {
    return this.service.uploadFile(tenant, knowledgeBaseId, file, title);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update document metadata' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDocumentDto,
  ) {
    return this.service.update(tenant, id, dto);
  }

  @Post(':id/reprocess')
  @ApiOperation({ summary: 'Reprocess document (new job)' })
  reprocess(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.reprocess(tenant, id);
  }

  @Post(':id/reembed')
  @ApiOperation({ summary: 'Re-chunk and re-embed document' })
  reembed(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.reembed(tenant, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete document' })
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.remove(tenant, id);
  }
}
