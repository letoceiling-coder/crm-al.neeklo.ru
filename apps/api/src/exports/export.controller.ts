import { Controller, Get, Param, Query, UseGuards, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ExportService } from './export.service';

@ApiTags('exports')
@Controller('v1/exports')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ExportController {
  constructor(private exports: ExportService) {}

  @Get(':domain')
  @ApiOperation({ summary: 'Export data (usage|audit|crm|workflow|marketplace)' })
  async exportDomain(
    @CurrentTenant() tenant: TenantContext,
    @Param('domain') domain: string,
    @Query('format') format: 'csv' | 'xlsx' | 'pdf' = 'csv',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fmt = format ?? 'csv';
    let result;
    switch (domain) {
      case 'usage':
        result = await this.exports.exportUsage(tenant, fmt, from, to);
        break;
      case 'audit':
        result = await this.exports.exportAudit(tenant, fmt);
        break;
      case 'crm':
        result = await this.exports.exportCrmLeads(tenant, fmt);
        break;
      case 'workflow':
        result = await this.exports.exportWorkflowExecutions(tenant, fmt);
        break;
      case 'marketplace':
        result = await this.exports.exportMarketplaceInstalls(tenant, fmt);
        break;
      default:
        result = await this.exports.exportUsage(tenant, fmt, from, to);
    }
    return this.exports.toStreamable(result);
  }
}
