const path = require('path');
process.chdir('/var/www/crm-al-tokens/apps/api');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  try {
    const ver = await p.$queryRaw`SELECT version()`;
    console.log('PG_VERSION:', ver[0].version);

    const ext = await p.$queryRaw`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    console.log('PGVECTOR:', ext.length ? ext[0].extname : 'NOT_INSTALLED');

    const migs = await p.$queryRaw`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10`;
    console.log('MIGRATIONS:', JSON.stringify(migs, null, 2));

    const org = await p.$queryRaw`SELECT to_regclass('public.organizations') as t`;
    console.log('TABLE organizations:', org[0].t);

    const keys = await p.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'api_keys' AND column_name = 'organization_id'`;
    console.log('api_keys.organization_id:', keys.length ? 'EXISTS' : 'MISSING');
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
}
main();
