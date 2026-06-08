import { Injectable, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async exportUsage(tenant: TenantContext, format: ExportFormat, from?: string, to?: string) {
    const where: Record<string, unknown> = {
      apiKey: { organizationId: tenant.organizationId },
    };
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const rows = await this.prisma.usageLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        createdAt: true,
        modelUsed: true,
        totalTokens: true,
        userCost: true,
        status: true,
        requestPath: true,
      },
    });

    const headers = ['date', 'model', 'tokens', 'cost_rub', 'status', 'path'];
    const data = rows.map((r) => [
      r.createdAt.toISOString(),
      r.modelUsed,
      String(r.totalTokens),
      String(r.userCost),
      r.status,
      r.requestPath ?? '',
    ]);

    return this.buildFile('usage', format, headers, data);
  }

  async exportAudit(tenant: TenantContext, format: ExportFormat) {
    const rows = await this.prisma.auditLog.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const headers = ['date', 'action', 'entity_type', 'entity_id', 'trace_id', 'ip'];
    const data = rows.map((r) => [
      r.createdAt.toISOString(),
      r.action,
      r.entityType ?? '',
      r.entityId ?? '',
      r.traceId ?? '',
      r.ipAddress ?? '',
    ]);

    return this.buildFile('audit', format, headers, data);
  }

  async exportCrmLeads(tenant: TenantContext, format: ExportFormat) {
    const rows = await this.prisma.crmLead.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['name', 'email', 'phone', 'source', 'status', 'created_at'];
    const data = rows.map((r) => [
      r.name,
      r.email ?? '',
      r.phone ?? '',
      r.source ?? '',
      r.status,
      r.createdAt.toISOString(),
    ]);

    return this.buildFile('crm-leads', format, headers, data);
  }

  async exportWorkflowExecutions(tenant: TenantContext, format: ExportFormat) {
    const rows = await this.prisma.workflowExecution.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: { workflow: { select: { name: true } } },
    });

    const headers = ['workflow', 'status', 'attempt', 'started', 'finished'];
    const data = rows.map((r) => [
      r.workflow.name,
      r.status,
      String(r.attempt),
      r.startedAt?.toISOString() ?? '',
      r.finishedAt?.toISOString() ?? '',
    ]);

    return this.buildFile('workflow-executions', format, headers, data);
  }

  async exportMarketplaceInstalls(tenant: TenantContext, format: ExportFormat) {
    const rows = await this.prisma.marketplaceInstall.findMany({
      where: { installedOrganizationId: tenant.organizationId },
      include: { package: { select: { name: true, slug: true } }, version: { select: { version: true } } },
    });

    const headers = ['package', 'slug', 'version', 'status', 'installed_at'];
    const data = rows.map((r) => [
      r.package.name,
      r.package.slug,
      r.version.version,
      r.status,
      r.createdAt.toISOString(),
    ]);

    return this.buildFile('marketplace-installs', format, headers, data);
  }

  private buildFile(
    prefix: string,
    format: ExportFormat,
    headers: string[],
    rows: string[][],
  ): { buffer: Buffer; mime: string; filename: string } {
    if (format === 'csv') {
      const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
      return {
        buffer: Buffer.from('\uFEFF' + csv, 'utf-8'),
        mime: 'text/csv; charset=utf-8',
        filename: `${prefix}.csv`,
      };
    }

    if (format === 'xlsx') {
      const xml = this.spreadsheetXml(headers, rows);
      return {
        buffer: Buffer.from(xml, 'utf-8'),
        mime: 'application/vnd.ms-excel',
        filename: `${prefix}.xls`,
      };
    }

    const pdf = this.minimalPdf(`${prefix} export`, headers, rows.slice(0, 100));
    return {
      buffer: Buffer.from(pdf, 'binary'),
      mime: 'application/pdf',
      filename: `${prefix}.pdf`,
    };
  }

  private spreadsheetXml(headers: string[], rows: string[][]) {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const rowXml = (cells: string[]) =>
      `<Row>${cells.map((c) => `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>`;
    return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Export"><Table>
${rowXml(headers)}
${rows.map(rowXml).join('\n')}
</Table></Worksheet></Workbook>`;
  }

  private minimalPdf(title: string, headers: string[], rows: string[][]) {
    const lines = [title, '', headers.join(' | '), ...rows.map((r) => r.join(' | '))];
    let y = 750;
    const content = lines
      .map((line) => {
        const cmd = `BT /F1 10 Tf 50 ${y} Td (${line.slice(0, 120).replace(/[()\\]/g, '')}) Tj ET`;
        y -= 14;
        return cmd;
      })
      .join('\n');

    const stream = `${content}\n`;
    const len = stream.length;
    return `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${len}>>stream
${stream}endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000261 00000 n 
0000000${(330 + len).toString().padStart(3, '0')} 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
${400 + len}
%%EOF`;
  }

  toStreamable(result: { buffer: Buffer; mime: string; filename: string }) {
    return new StreamableFile(result.buffer, {
      type: result.mime,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }
}
