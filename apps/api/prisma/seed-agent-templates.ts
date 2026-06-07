import { PrismaClient, AgentType, Prisma } from '@prisma/client';

const SYSTEM_TEMPLATES: Array<{
  name: string;
  slug: string;
  description: string;
  agentType: AgentType;
  defaultPrompt: string;
  defaultSettings: Record<string, unknown>;
  isMarketplace?: boolean;
}> = [
  {
    name: 'Lawyer',
    slug: 'lawyer',
    description: 'Legal analysis and document review assistant',
    agentType: AgentType.LAWYER,
    defaultPrompt:
      'You are a legal assistant for {{company_name}}. Contact: {{phone}}, {{email}}. Website: {{website}}.',
    defaultSettings: { temperature: 0.3 },
    isMarketplace: true,
  },
  {
    name: 'Marketing',
    slug: 'marketing',
    description: 'Marketing strategy and campaign assistant',
    agentType: AgentType.MARKETING,
    defaultPrompt: 'You are a marketing expert for {{company_name}}. CRM: {{crm_url}}.',
    defaultSettings: { temperature: 0.8 },
    isMarketplace: true,
  },
  {
    name: 'Developer',
    slug: 'developer',
    description: 'Software development and architecture assistant',
    agentType: AgentType.DEVELOPER,
    defaultPrompt: 'You are a senior developer helping {{company_name}} engineering team.',
    defaultSettings: { temperature: 0.2 },
    isMarketplace: true,
  },
  {
    name: 'Sales',
    slug: 'sales',
    description: 'Sales and lead qualification assistant',
    agentType: AgentType.SALES,
    defaultPrompt: 'You are a sales assistant for {{company_name}}. CRM portal: {{crm_url}}.',
    defaultSettings: { temperature: 0.6 },
    isMarketplace: true,
  },
  {
    name: 'Support',
    slug: 'support',
    description: 'Customer support assistant',
    agentType: AgentType.SUPPORT,
    defaultPrompt:
      'You are customer support for {{company_name}}. Phone: {{phone}}, email: {{email}}.',
    defaultSettings: { temperature: 0.5 },
    isMarketplace: true,
  },
  {
    name: 'HR',
    slug: 'hr',
    description: 'Human resources assistant',
    agentType: AgentType.HR,
    defaultPrompt: 'You are an HR assistant for {{company_name}}.',
    defaultSettings: { temperature: 0.4 },
    isMarketplace: false,
  },
  {
    name: 'Real Estate',
    slug: 'real-estate',
    description: 'Real estate listing and client assistant',
    agentType: AgentType.REAL_ESTATE,
    defaultPrompt: 'You are a real estate assistant for {{company_name}}. Website: {{website}}.',
    defaultSettings: { temperature: 0.5 },
    isMarketplace: true,
  },
  {
    name: 'Education',
    slug: 'education',
    description: 'Educational content and tutoring assistant',
    agentType: AgentType.EDUCATION,
    defaultPrompt: 'You are an education assistant for {{company_name}}.',
    defaultSettings: { temperature: 0.7 },
    isMarketplace: false,
  },
  {
    name: 'General Assistant',
    slug: 'assistant',
    description: 'General purpose organizational assistant',
    agentType: AgentType.ASSISTANT,
    defaultPrompt: 'You are a helpful assistant for {{company_name}}.',
    defaultSettings: { temperature: 0.7 },
    isMarketplace: true,
  },
  {
    name: 'Custom',
    slug: 'custom',
    description: 'Blank template for custom assistants',
    agentType: AgentType.CUSTOM,
    defaultPrompt: 'You are an AI assistant for {{company_name}}.',
    defaultSettings: { temperature: 0.7 },
    isMarketplace: false,
  },
];

export async function seedAgentTemplates(prisma: PrismaClient) {
  for (const t of SYSTEM_TEMPLATES) {
    await prisma.agentTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        agentType: t.agentType,
        defaultPrompt: t.defaultPrompt,
        defaultSettings: t.defaultSettings as Prisma.InputJsonValue,
        isPublic: true,
        isMarketplace: t.isMarketplace ?? false,
      },
      create: {
        name: t.name,
        slug: t.slug,
        description: t.description,
        agentType: t.agentType,
        defaultPrompt: t.defaultPrompt,
        defaultSettings: t.defaultSettings as Prisma.InputJsonValue,
        isPublic: true,
        isMarketplace: t.isMarketplace ?? false,
      },
    });
  }
}
