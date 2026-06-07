import { PrismaClient, ToolProviderType, Prisma } from '@prisma/client';

type CatalogEntry = {
  provider: { slug: string; name: string; providerType: ToolProviderType; description?: string };
  definition: {
    slug: string;
    name: string;
    description: string;
    providerType: ToolProviderType;
    inputSchema?: Record<string, unknown>;
    settingsSchema?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
};

const jsonSchema = (props: Record<string, unknown>) => ({
  type: 'object',
  properties: props,
});

export const TOOL_CATALOG: CatalogEntry[] = [
  {
    provider: { slug: 'internal', name: 'Internal', providerType: ToolProviderType.INTERNAL, description: 'Built-in platform tools' },
    definition: {
      slug: 'telegram',
      name: 'Telegram',
      description: 'Send messages via Telegram Bot API',
      providerType: ToolProviderType.INTERNAL,
      settingsSchema: jsonSchema({ chatId: { type: 'string', title: 'Chat ID' } }),
      inputSchema: jsonSchema({ message: { type: 'string' } }),
      metadata: { requiresSecret: true, secretLabel: 'Bot Token' },
    },
  },
  {
    provider: { slug: 'internal', name: 'Internal', providerType: ToolProviderType.INTERNAL },
    definition: {
      slug: 'max',
      name: 'MAX',
      description: 'Send messages via MAX messenger',
      providerType: ToolProviderType.INTERNAL,
      settingsSchema: jsonSchema({ channelId: { type: 'string' } }),
      inputSchema: jsonSchema({ message: { type: 'string' } }),
      metadata: { requiresSecret: true, secretLabel: 'API Key' },
    },
  },
  {
    provider: { slug: 'internal', name: 'Internal', providerType: ToolProviderType.INTERNAL },
    definition: {
      slug: 'email',
      name: 'Email',
      description: 'Send email messages',
      providerType: ToolProviderType.INTERNAL,
      settingsSchema: jsonSchema({
        fromEmail: { type: 'string' },
        smtpHost: { type: 'string' },
      }),
      inputSchema: jsonSchema({
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      }),
      metadata: { requiresSecret: true, secretLabel: 'SMTP Password' },
    },
  },
  {
    provider: { slug: 'webhook', name: 'Webhook', providerType: ToolProviderType.WEBHOOK, description: 'Outbound webhooks' },
    definition: {
      slug: 'webhook',
      name: 'Webhook',
      description: 'POST payload to a webhook URL',
      providerType: ToolProviderType.WEBHOOK,
      settingsSchema: jsonSchema({ url: { type: 'string', format: 'uri' } }),
      inputSchema: jsonSchema({ payload: { type: 'object' } }),
      metadata: { requiresSecret: false },
    },
  },
  {
    provider: { slug: 'rest-api', name: 'REST API', providerType: ToolProviderType.REST_API, description: 'Generic HTTP requests' },
    definition: {
      slug: 'http-request',
      name: 'HTTP Request',
      description: 'Execute HTTP requests to external APIs',
      providerType: ToolProviderType.REST_API,
      settingsSchema: jsonSchema({
        baseUrl: { type: 'string' },
        defaultHeaders: { type: 'object' },
      }),
      inputSchema: jsonSchema({
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        path: { type: 'string' },
        body: { type: 'object' },
      }),
      metadata: { requiresSecret: true, secretLabel: 'API Key / Bearer Token' },
    },
  },
  {
    provider: { slug: 'internal', name: 'Internal', providerType: ToolProviderType.INTERNAL },
    definition: {
      slug: 'create-lead',
      name: 'Create Lead',
      description: 'Create a CRM lead',
      providerType: ToolProviderType.INTERNAL,
      inputSchema: jsonSchema({
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
      }),
      metadata: { category: 'crm' },
    },
  },
  {
    provider: { slug: 'internal', name: 'Internal', providerType: ToolProviderType.INTERNAL },
    definition: {
      slug: 'create-client',
      name: 'Create Client',
      description: 'Create a CRM client',
      providerType: ToolProviderType.INTERNAL,
      inputSchema: jsonSchema({ name: { type: 'string' }, phone: { type: 'string' } }),
      metadata: { category: 'crm' },
    },
  },
  {
    provider: { slug: 'internal', name: 'Internal', providerType: ToolProviderType.INTERNAL },
    definition: {
      slug: 'create-note',
      name: 'Create Note',
      description: 'Create a CRM note',
      providerType: ToolProviderType.INTERNAL,
      inputSchema: jsonSchema({
        entityType: { type: 'string', enum: ['CLIENT', 'LEAD', 'DEAL', 'TASK'] },
        entityId: { type: 'string' },
        text: { type: 'string' },
      }),
      metadata: { category: 'crm' },
    },
  },
  {
    provider: { slug: 'internal', name: 'Internal', providerType: ToolProviderType.INTERNAL },
    definition: {
      slug: 'create-task',
      name: 'Create Task',
      description: 'Create a CRM task',
      providerType: ToolProviderType.INTERNAL,
      inputSchema: jsonSchema({ title: { type: 'string' }, dueDate: { type: 'string' } }),
      metadata: { category: 'crm' },
    },
  },
  {
    provider: { slug: 'internal', name: 'Internal', providerType: ToolProviderType.INTERNAL },
    definition: {
      slug: 'generate-pdf',
      name: 'Generate PDF',
      description: 'Generate PDF document from template',
      providerType: ToolProviderType.INTERNAL,
      inputSchema: jsonSchema({ templateId: { type: 'string' }, data: { type: 'object' } }),
      metadata: { category: 'documents' },
    },
  },
  {
    provider: { slug: 'internal', name: 'Internal', providerType: ToolProviderType.INTERNAL },
    definition: {
      slug: 'generate-docx',
      name: 'Generate DOCX',
      description: 'Generate DOCX document from template',
      providerType: ToolProviderType.INTERNAL,
      inputSchema: jsonSchema({ templateId: { type: 'string' }, data: { type: 'object' } }),
      metadata: { category: 'documents' },
    },
  },
  {
    provider: { slug: 'internal', name: 'Internal', providerType: ToolProviderType.INTERNAL },
    definition: {
      slug: 'knowledge-search',
      name: 'Knowledge Search',
      description: 'Search connected knowledge bases',
      providerType: ToolProviderType.INTERNAL,
      settingsSchema: jsonSchema({ knowledgeBaseId: { type: 'string' } }),
      inputSchema: jsonSchema({ query: { type: 'string' }, limit: { type: 'number' } }),
      metadata: { category: 'knowledge' },
    },
  },
];

export async function seedToolCatalog(prisma: PrismaClient) {
  const providerIds = new Map<string, string>();

  for (const entry of TOOL_CATALOG) {
    let providerId = providerIds.get(entry.provider.slug);
    if (!providerId) {
      const provider = await prisma.toolProvider.upsert({
        where: { slug: entry.provider.slug },
        update: {
          name: entry.provider.name,
          providerType: entry.provider.providerType,
          description: entry.provider.description,
          isActive: true,
        },
        create: {
          slug: entry.provider.slug,
          name: entry.provider.name,
          providerType: entry.provider.providerType,
          description: entry.provider.description,
        },
      });
      providerId = provider.id;
      providerIds.set(entry.provider.slug, providerId);
    }

    await prisma.toolDefinition.upsert({
      where: { slug: entry.definition.slug },
      update: {
        name: entry.definition.name,
        description: entry.definition.description,
        providerType: entry.definition.providerType,
        inputSchema: (entry.definition.inputSchema ?? {}) as Prisma.InputJsonValue,
        settingsSchema: (entry.definition.settingsSchema ?? {}) as Prisma.InputJsonValue,
        metadata: (entry.definition.metadata ?? {}) as Prisma.InputJsonValue,
        isActive: true,
        isPublic: true,
        isSystem: true,
      },
      create: {
        providerId,
        slug: entry.definition.slug,
        name: entry.definition.name,
        description: entry.definition.description,
        providerType: entry.definition.providerType,
        inputSchema: (entry.definition.inputSchema ?? {}) as Prisma.InputJsonValue,
        outputSchema: { type: 'object' } as Prisma.InputJsonValue,
        settingsSchema: (entry.definition.settingsSchema ?? {}) as Prisma.InputJsonValue,
        metadata: (entry.definition.metadata ?? {}) as Prisma.InputJsonValue,
        isSystem: true,
        isPublic: true,
      },
    });
  }

  console.log(`Tool catalog seeded: ${TOOL_CATALOG.length} definitions`);
}
