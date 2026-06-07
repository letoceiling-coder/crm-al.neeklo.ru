import { Injectable } from '@nestjs/common';
import { CrmActivityAction, CrmEntityType } from '@prisma/client';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CrmLeadService } from './crm-lead.service';
import { CrmClientService } from './crm-client.service';
import { CrmTaskService } from './crm-task.service';
import { CrmNoteService } from './crm-note.service';
import { CrmActivityService } from './crm-activity.service';
import { CrmWorkspaceService } from './crm-workspace.service';

@Injectable()
export class CrmToolService {
  constructor(
    private leads: CrmLeadService,
    private clients: CrmClientService,
    private tasks: CrmTaskService,
    private notes: CrmNoteService,
    private activities: CrmActivityService,
    private workspace: CrmWorkspaceService,
  ) {}

  async executeTool(
    tenant: TenantContext,
    slug: string,
    input: Record<string, unknown>,
    assistantId?: string,
  ): Promise<Record<string, unknown>> {
    switch (slug) {
      case 'create-lead': {
        const lead = await this.leads.create(
          tenant,
          {
            name: String(input.name ?? 'New Lead'),
            email: input.email ? String(input.email) : undefined,
            phone: input.phone ? String(input.phone) : undefined,
            source: input.source ? String(input.source) : 'tool',
          },
          assistantId,
        );
        if (assistantId) {
          await this.activities.log({
            organizationId: tenant.organizationId,
            entityType: CrmEntityType.LEAD,
            entityId: lead.id,
            action: CrmActivityAction.TOOL_EXECUTED,
            metadata: { tool: slug, assistantId },
          });
        }
        return { id: lead.id, entity: 'lead', lead };
      }
      case 'create-client': {
        const client = await this.clients.create(
          tenant,
          {
            name: String(input.name ?? 'New Client'),
            phone: input.phone ? String(input.phone) : undefined,
            email: input.email ? String(input.email) : undefined,
            company: input.company ? String(input.company) : undefined,
          },
          assistantId,
        );
        if (assistantId) {
          await this.activities.log({
            organizationId: tenant.organizationId,
            entityType: CrmEntityType.CLIENT,
            entityId: client.id,
            action: CrmActivityAction.TOOL_EXECUTED,
            metadata: { tool: slug, assistantId },
          });
        }
        return { id: client.id, entity: 'client', client };
      }
      case 'create-note': {
        const entityType = String(input.entityType ?? 'CLIENT').toUpperCase() as CrmEntityType;
        const entityId = String(input.entityId ?? '');
        const content = String(input.text ?? input.content ?? '');
        if (!entityId || !content) throw new Error('entityId and content required');
        const note = await this.notes.create(
          tenant,
          { entityType, entityId, content },
          assistantId,
        );
        return { id: note.id, entity: 'note', note };
      }
      case 'create-task': {
        const task = await this.tasks.create(
          tenant,
          {
            title: String(input.title ?? 'New Task'),
            description: input.description ? String(input.description) : undefined,
            dueDate: input.dueDate ? String(input.dueDate) : undefined,
          },
          assistantId,
        );
        if (assistantId) {
          await this.activities.log({
            organizationId: tenant.organizationId,
            entityType: CrmEntityType.TASK,
            entityId: task.id,
            action: CrmActivityAction.TOOL_EXECUTED,
            metadata: { tool: slug, assistantId },
          });
        }
        return { id: task.id, entity: 'task', task };
      }
      default:
        throw new Error(`Unknown CRM tool: ${slug}`);
    }
  }

  async testCrmTool(tenant: TenantContext, slug: string): Promise<Record<string, unknown>> {
    const crmTools = ['create-lead', 'create-client', 'create-note', 'create-task'];
    if (!crmTools.includes(slug)) throw new Error('Not a CRM tool');
    await this.workspace.ensureWorkspace(tenant.organizationId);
    return { ok: true, tool: slug, message: 'CRM workspace ready' };
  }
}
