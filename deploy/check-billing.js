const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const keyId = process.argv[2] || 'cmpw7081n009qvti0sd7lo5q3';

(async () => {
  const logs = await p.usageLog.findMany({
    where: { apiKeyId: keyId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      createdAt: true,
      profileSlug: true,
      inputTokens: true,
      outputTokens: true,
      userCost: true,
    },
  });
  console.log(JSON.stringify(logs, null, 2));
  const agg = await p.usageLog.aggregate({
    where: {
      apiKeyId: keyId,
      status: { in: ['SUCCESS', 'FALLBACK'] },
    },
    _sum: { userCost: true },
  });
  const key = await p.apiKey.findUnique({
    where: { id: keyId },
    select: { balanceRub: true, spentRub: true },
  });
  console.log('total userCost', Number(agg._sum.userCost), 'key', key);
  await p.$disconnect();
})();
