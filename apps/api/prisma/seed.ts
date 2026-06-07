import { PrismaClient, UserRole, ModelLabel } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 12);
  const devPassword = await bcrypt.hash('dev123', 12);
  const prodAdminPassword = await bcrypt.hash('123123123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@ai-gateway.local' },
    update: {},
    create: {
      email: 'admin@ai-gateway.local',
      passwordHash: adminPassword,
      name: 'Administrator',
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'dsc-23@yandex.ru' },
    update: {
      passwordHash: prodAdminPassword,
      name: 'Джон Уик',
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      email: 'dsc-23@yandex.ru',
      passwordHash: prodAdminPassword,
      name: 'Джон Уик',
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'dev@ai-gateway.local' },
    update: {},
    create: {
      email: 'dev@ai-gateway.local',
      passwordHash: devPassword,
      name: 'Developer',
      role: UserRole.DEVELOPER,
    },
  });

  const models = [
    {
      openrouterId: 'anthropic/claude-sonnet-4',
      name: 'Claude Sonnet 4',
      provider: 'anthropic',
      contextLength: 200000,
      inputPrice: 300,
      outputPrice: 1500,
      labels: [ModelLabel.PREMIUM, ModelLabel.CODING],
      capabilities: ['chat', 'vision'],
    },
    {
      openrouterId: 'openai/gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      contextLength: 128000,
      inputPrice: 15,
      outputPrice: 60,
      labels: [ModelLabel.CHEAP, ModelLabel.FAST],
      capabilities: ['chat'],
    },
    {
      openrouterId: 'google/gemini-2.5-flash-preview',
      name: 'Gemini 2.5 Flash',
      provider: 'google',
      contextLength: 1000000,
      inputPrice: 10,
      outputPrice: 40,
      labels: [ModelLabel.FAST, ModelLabel.CHEAP],
      capabilities: ['chat', 'vision'],
    },
    {
      openrouterId: 'deepseek/deepseek-chat',
      name: 'DeepSeek V3',
      provider: 'deepseek',
      contextLength: 64000,
      inputPrice: 14,
      outputPrice: 28,
      labels: [ModelLabel.CHEAP, ModelLabel.CODING],
      capabilities: ['chat'],
    },
    {
      openrouterId: 'meta-llama/llama-3.3-70b-instruct:free',
      name: 'Llama 3.3 70B (Free)',
      provider: 'meta-llama',
      contextLength: 128000,
      inputPrice: 0,
      outputPrice: 0,
      isFree: true,
      labels: [ModelLabel.FREE],
      capabilities: ['chat'],
    },
  ];

  for (const m of models) {
    await prisma.model.upsert({
      where: { openrouterId: m.openrouterId },
      update: {},
      create: m,
    });
  }

  const allModels = await prisma.model.findMany();
  const claude = allModels.find((m) => m.openrouterId.includes('claude'))!;
  const gpt = allModels.find((m) => m.openrouterId.includes('gpt'))!;

  const agents = [
    {
      name: 'Юрист',
      slug: 'lawyer',
      description: 'Юридический консультант для анализа документов и договоров',
      avatar: '⚖️',
      systemPrompt: 'Ты опытный юрист. Анализируй документы, объясняй правовые аспекты простым языком.',
      temperature: 0.3,
    },
    {
      name: 'Маркетолог',
      slug: 'marketer',
      description: 'Эксперт по маркетинговым стратегиям и рекламным кампаниям',
      avatar: '📈',
      systemPrompt: 'Ты маркетолог с 15-летним опытом. Помогай создавать стратегии, анализировать аудиторию.',
      temperature: 0.8,
    },
    {
      name: 'Копирайтер',
      slug: 'copywriter',
      description: 'Создание продающих текстов и контента',
      avatar: '✍️',
      systemPrompt: 'Ты профессиональный копирайтер. Пиши убедительные тексты для разных форматов.',
      temperature: 0.9,
    },
    {
      name: 'Разработчик',
      slug: 'developer',
      description: 'Помощник по программированию и архитектуре',
      avatar: '💻',
      systemPrompt: 'Ты senior разработчик. Помогай писать код, рефакторить и проектировать системы.',
      temperature: 0.2,
    },
    {
      name: 'Поддержка клиентов',
      slug: 'support',
      description: 'Ассистент для обработки обращений клиентов',
      avatar: '🎧',
      systemPrompt: 'Ты специалист поддержки. Отвечай вежливо, решай проблемы клиентов эффективно.',
      temperature: 0.5,
    },
  ];

  for (const a of agents) {
    const agent = await prisma.agent.upsert({
      where: { slug: a.slug },
      update: {},
      create: a,
    });

    const existing = await prisma.agentModelChain.count({ where: { agentId: agent.id } });
    if (!existing) {
      await prisma.agentModelChain.createMany({
        data: [
          { agentId: agent.id, modelId: claude.id, priority: 0 },
          { agentId: agent.id, modelId: gpt.id, priority: 1 },
        ],
      });
    }
  }

  console.log('Seed completed');
  console.log('Admin: admin@ai-gateway.local / admin123');
  console.log('Developer: dev@ai-gateway.local / dev123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
