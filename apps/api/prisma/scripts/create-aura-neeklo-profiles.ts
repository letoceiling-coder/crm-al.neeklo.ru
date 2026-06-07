/**
 * Creates KeyModelProfile: auto, aura, neeklo
 * Run: npx ts-node prisma/scripts/create-aura-neeklo-profiles.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DOC_KEYWORDS =
  /document|contract|legal|pdf|ocr|text|instruct|chat|gemini|llama|mistral|qwen|deepseek|claude|gpt|vision|multimodal/i;
const ROUTER_IDS = new Set([
  'openrouter/auto',
  'openrouter/free',
  'openrouter/owl-alpha',
  'openrouter/bodybuilder',
  'openrouter/pareto-code',
]);

const EXCLUDE_KEYWORDS =
  /embed|rerank|moderation|image-only|audio-only|tts|whisper|dall-e|stable-diffusion|flux-dev|video|music|laguna|bodybuilder|pareto/i;

function suitsDocuments(m: {
  name: string;
  openrouterId: string;
  description: string | null;
  contextLength: number;
  capabilities: string[];
  isFree: boolean;
}): boolean {
  if (ROUTER_IDS.has(m.openrouterId)) return false;
  const text = `${m.name} ${m.openrouterId} ${m.description ?? ''}`;
  if (EXCLUDE_KEYWORDS.test(text)) return false;
  if (m.contextLength < 16000) return false;
  if (/:(free)$/.test(m.openrouterId) || m.isFree) {
    if (/1\.2b|1b-instruct|3b-instruct|nano-9b|360m|135m/i.test(text)) return false;
    return true;
  }
  if (DOC_KEYWORDS.test(text)) return true;
  return m.contextLength >= 32000;
}

function suitsFreeLanguage(m: {
  name: string;
  openrouterId: string;
  description: string | null;
  contextLength: number;
  isFree: boolean;
}): boolean {
  if (!m.isFree) return false;
  if (ROUTER_IDS.has(m.openrouterId)) return false;
  const text = `${m.name} ${m.openrouterId} ${m.description ?? ''}`;
  if (EXCLUDE_KEYWORDS.test(text)) return false;
  if (/embed|rerank|moderat/i.test(m.openrouterId)) return false;
  if (m.contextLength < 8000) return false;
  if (/1\.2b|1b-instruct|3b-instruct|360m|135m|0\.5b/i.test(text)) return false;
  return true;
}

function scoreFreeModel(m: {
  openrouterId: string;
  name: string;
  contextLength: number;
}): number {
  let s = m.contextLength / 1000;
  const id = `${m.openrouterId} ${m.name}`.toLowerCase();
  if (/llama-3\.3-70b|llama-3\.1-70b|llama-3\.1-405b|405b/i.test(id)) s += 120;
  if (/qwen.*72b|qwen3|gemma-4|gemini/i.test(id)) s += 100;
  if (/mistral.*24b|mistral.*large|dolphin/i.test(id)) s += 90;
  if (/deepseek|gpt-oss|kimi|glm-4|nemotron.*120|hermes/i.test(id)) s += 85;
  if (/coder/i.test(id)) s -= 15;
  if (/nano-9b(?!.*30)/i.test(id)) s -= 25;
  return s;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: 'dsc-23@yandex.ru' },
  });
  if (!admin) {
    console.error('Admin user dsc-23@yandex.ru not found');
    process.exit(1);
  }

  const all = await prisma.model.findMany({
    where: { isEnabled: true },
    orderBy: { inputPrice: 'asc' },
  });

  const docModels = all.filter(suitsDocuments);
  const freeDoc = docModels.filter((m) => m.isFree);
  const paidDoc = docModels.filter((m) => !m.isFree);

  const paidCheap = paidDoc
    .filter((m) => {
      const p = Number(m.inputPrice);
      return p > 0 && p <= 1.5 && m.contextLength >= 32000;
    })
    .sort((a, b) => Number(a.inputPrice) - Number(b.inputPrice))
    .slice(0, 2);

  const paidMedium = paidDoc
    .filter((m) => {
      const p = Number(m.inputPrice);
      return p > 0.3 && p <= 12 && m.contextLength >= 32000;
    })
    .sort((a, b) => Number(a.inputPrice) - Number(b.inputPrice));

  const freeLang = all
    .filter(suitsFreeLanguage)
    .sort((a, b) => scoreFreeModel(b) - scoreFreeModel(a));

  const paidCheapAuto = paidDoc
    .filter((m) => {
      const p = Number(m.inputPrice);
      return p > 0 && p <= 1.2 && m.contextLength >= 32000;
    })
    .sort((a, b) => Number(a.inputPrice) - Number(b.inputPrice))
    .slice(0, 2);

  const autoChain = [...freeLang, ...paidCheapAuto];

  const auraChain = [...freeDoc, ...paidCheap];
  const neekloChain = paidMedium.length >= 6 ? paidMedium.slice(0, 15) : paidDoc.filter((m) => m.contextLength >= 32000).slice(0, 12);

  console.log(`Free language models: ${freeLang.length}`);
  console.log(`Auto chain: ${autoChain.length} (${paidCheapAuto.length} paid fallback)`);
  console.log(`Free doc models: ${freeDoc.length}`);
  console.log(`Aura chain: ${auraChain.length} (${paidCheap.length} paid)`);
  console.log(`Neeklo chain: ${neekloChain.length}`);

  if (auraChain.length < 3) {
    console.warn('Warning: few aura models, using broader free set');
    const extraFree = all.filter((m) => m.isFree && m.contextLength >= 8000).slice(0, 15);
    auraChain.push(...extraFree.filter((m) => !auraChain.find((x) => x.id === m.id)));
  }

  const profiles = [
    {
      slug: 'auto',
      name: 'Auto',
      description:
        'Все бесплатные языковые модели (оптимальный порядок) + 2 дешёвые платные при недоступности',
      pricePerMillionRub: 2000,
      models: autoChain,
    },
    {
      slug: 'aura',
      name: 'Aura',
      description:
        'Бесплатные языковые модели для документов и договоров + 2 недорогие платные (fallback)',
      pricePerMillionRub: 3000,
      models: auraChain,
    },
    {
      slug: 'neeklo',
      name: 'Neeklo',
      description:
        'Платные модели средней цены для анализа документов и договоров (от дешёвых к дорогим)',
      pricePerMillionRub: 8000,
      models: neekloChain,
    },
  ];

  for (const spec of profiles) {
    const existing = await prisma.keyModelProfile.findUnique({
      where: { userId_slug: { userId: admin.id, slug: spec.slug } },
    });

    if (existing) {
      await prisma.keyModelProfileChain.deleteMany({ where: { profileId: existing.id } });
      await prisma.keyModelProfilePricing.deleteMany({ where: { profileId: existing.id } });
      await prisma.keyModelProfile.update({
        where: { id: existing.id },
        data: {
          name: spec.name,
          description: spec.description,
          pricePerMillionRub: spec.pricePerMillionRub,
          isActive: true,
        },
      });

      await prisma.keyModelProfileChain.createMany({
        data: spec.models.map((m, i) => ({
          profileId: existing.id,
          modelId: m.id,
          priority: i,
        })),
      });

      await prisma.keyModelProfilePricing.createMany({
        data: spec.models.map((m) => ({
          profileId: existing.id,
          modelId: m.id,
          costPrice: Number(m.inputPrice),
          sellPrice: spec.pricePerMillionRub,
          margin: spec.pricePerMillionRub - Number(m.inputPrice),
        })),
      });

      console.log(`Updated profile "${spec.slug}" with ${spec.models.length} models`);
      spec.models.forEach((m, i) =>
        console.log(`  ${i + 1}. ${m.openrouterId} (${m.isFree ? 'FREE' : 'paid'})`),
      );
      continue;
    }

    const profile = await prisma.keyModelProfile.create({
      data: {
        userId: admin.id,
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
        pricePerMillionRub: spec.pricePerMillionRub,
      },
    });

    await prisma.keyModelProfileChain.createMany({
      data: spec.models.map((m, i) => ({
        profileId: profile.id,
        modelId: m.id,
        priority: i,
      })),
    });

    await prisma.keyModelProfilePricing.createMany({
      data: spec.models.map((m) => ({
        profileId: profile.id,
        modelId: m.id,
        costPrice: Number(m.inputPrice),
        sellPrice: spec.pricePerMillionRub,
        margin: spec.pricePerMillionRub - Number(m.inputPrice),
      })),
    });

    console.log(`Created profile "${spec.slug}" with ${spec.models.length} models`);
    spec.models.forEach((m, i) =>
      console.log(`  ${i + 1}. ${m.openrouterId} (${m.isFree ? 'FREE' : 'paid'})`),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
