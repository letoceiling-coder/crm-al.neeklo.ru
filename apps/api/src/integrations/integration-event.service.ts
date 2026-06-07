import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { IntegrationEventStatus, IntegrationProviderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowTriggerService } from '../workflows/workflow-trigger.service';

@Injectable()
export class IntegrationEventService {
  private readonly logger = new Logger(IntegrationEventService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(forwardRef(() => WorkflowTriggerService))
    private workflowTriggers?: WorkflowTriggerService,
  ) {}

  async record(params: {
    organizationId: string;
    provider: IntegrationProviderType;
    accountId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }) {
    const event = await this.prisma.integrationEvent.create({
      data: {
        organizationId: params.organizationId,
        provider: params.provider,
        accountId: params.accountId,
        eventType: params.eventType,
        payload: params.payload as object,
        status: IntegrationEventStatus.PENDING,
      },
    });

    try {
      void this.workflowTriggers?.emitIntegrationEvent(
        params.organizationId,
        params.eventType,
        { eventId: event.id, accountId: params.accountId, ...params.payload },
      );

      await this.prisma.integrationEvent.update({
        where: { id: event.id },
        data: { status: IntegrationEventStatus.PROCESSED, processedAt: new Date() },
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Event processing failed: ${err}`);
      await this.prisma.integrationEvent.update({
        where: { id: event.id },
        data: { status: IntegrationEventStatus.FAILED, error: err },
      });
    }

    return event;
  }

  async list(organizationId: string, accountId?: string) {
    return this.prisma.integrationEvent.findMany({
      where: { organizationId, ...(accountId ? { accountId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
