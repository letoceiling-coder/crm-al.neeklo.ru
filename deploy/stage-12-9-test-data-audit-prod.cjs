#!/usr/bin/env node
/**
 * Stage 12.9 — ETAP 7: Test Data Audit
 * Audits the "AgentCrm Test Knowledge Base" and all related test/golden/benchmark data.
 * READ-ONLY. No deletions.
 */
'use strict';
process.chdir('/var/www/crm-al-tokens/apps/api');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const OUT = process.env.AUDIT_OUT || '/tmp/stage-12-9-test-data-audit.json';
const p = new PrismaClient();

async function main() {
  // 1. Find the AgentCrm Test Knowledge Base
  const testKbs = await p.knowledgeBase.findMany({
    where: { name: { contains: 'AgentCrm', mode: 'insensitive' } },
    include: {
      _count: {
        select: {
          documents: true,
          categories: true,
          topics: true,
          tags: true,
          chunks: true,
        },
      },
    },
  });

  // 2. For each test KB, classify documents
  const kbReports = [];
  for (const kb of testKbs) {
    const docs = await p.knowledgeDocument.findMany({
      where: { knowledgeBaseId: kb.id },
      select: {
        id: true,
        title: true,
        format: true,
        status: true,
        parserChars: true,
        metadata: true,
        createdAt: true,
      },
    });

    const classified = docs.map((d) => {
      const meta = (d.metadata || {});
      const isGolden = Boolean(meta.goldenId || meta.isGolden);
      const isBenchmark = Boolean(meta.benchmarkId || meta.isBenchmark);
      const isEnterprise = Boolean(meta.enterpriseId || meta.isEnterprise);
      const validationCohort = meta.validationCohort || null;
      const pipelineVersion = meta.pipelineVersion || null;

      let dataType = 'real';
      if (isGolden) dataType = 'golden';
      else if (isBenchmark) dataType = 'benchmark';
      else if (isEnterprise) dataType = 'enterprise';
      else if (validationCohort) dataType = 'validation';

      return {
        id: d.id,
        title: d.title,
        format: d.format,
        status: d.status,
        chars: d.parserChars,
        dataType,
        validationCohort,
        pipelineVersion,
        isGolden,
        isBenchmark,
        isEnterprise,
        canDelete: dataType !== 'real' && dataType !== 'golden', // golden = keep
        recommendation: dataType === 'golden'
          ? 'KEEP — golden reference corpus'
          : dataType === 'validation'
          ? 'KEEP — validation history'
          : dataType === 'benchmark'
          ? 'CAN_DELETE — benchmark artifact'
          : dataType === 'enterprise'
          ? 'CAN_DELETE — enterprise load test artifact'
          : 'KEEP — real document',
      };
    });

    const byCounts = {
      total: classified.length,
      real: classified.filter(d => d.dataType === 'real').length,
      golden: classified.filter(d => d.dataType === 'golden').length,
      benchmark: classified.filter(d => d.dataType === 'benchmark').length,
      enterprise: classified.filter(d => d.dataType === 'enterprise').length,
      validation: classified.filter(d => d.dataType === 'validation').length,
      canDelete: classified.filter(d => d.canDelete).length,
    };

    kbReports.push({
      kb: {
        id: kb.id,
        name: kb.name,
        slug: kb.slug,
        counts: kb._count,
      },
      documentCounts: byCounts,
      documents: classified,
    });
  }

  // 3. Find any orphan validation cohort documents outside test KBs
  const cohortDocs = await p.$queryRaw`
    SELECT id, title, status, metadata->>'validationCohort' as cohort,
           knowledge_base_id
    FROM knowledge_documents
    WHERE metadata ? 'validationCohort'
    LIMIT 100
  `;

  // 4. Find benchmark run artifacts
  const benchmarkRuns = await p.agentCrmBenchmarkRun.count();

  // 5. Pipeline run counts
  const pipelineRuns = await p.knowledgePipelineRun.count();
  const pipelineRunsByKb = await p.$queryRaw`
    SELECT knowledge_base_id, COUNT(*) as cnt
    FROM knowledge_pipeline_runs
    GROUP BY knowledge_base_id
    ORDER BY cnt DESC
    LIMIT 10
  `;

  // 6. Tag suggestions counts
  const tagSuggestionsTotal = await p.knowledgeTagSuggestion.count();
  const tagSuggestionsByStatus = await p.$queryRaw`
    SELECT status, COUNT(*) as cnt
    FROM knowledge_tag_suggestions
    GROUP BY status
  `;

  // 7. Extracted entities
  const entitiesTotal = await p.knowledgeExtractedEntity.count();

  const report = {
    generatedAt: new Date().toISOString(),
    testKbs: kbReports,
    cohortDocuments: cohortDocs,
    globalStats: {
      benchmarkRuns,
      pipelineRuns,
      pipelineRunsByKb,
      tagSuggestionsTotal,
      tagSuggestionsByStatus,
      entitiesTotal,
    },
    cleanupRecommendations: [
      'Documents with dataType=benchmark can be deleted after confirming no active benchmark references',
      'Documents with dataType=enterprise were load test artifacts and can be deleted',
      'validation cohort documents (cohort=stage-12-8-5-2-phase-a) can be cleaned up',
      'Golden documents MUST be kept — they are the reference corpus',
      'Pipeline runs and tag suggestions for deleted documents will cascade-delete automatically',
    ],
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    testKbsFound: kbReports.length,
    totalDocs: kbReports.reduce((a, b) => a + b.documentCounts.total, 0),
    canDelete: kbReports.reduce((a, b) => a + b.documentCounts.canDelete, 0),
    outputFile: OUT,
  }, null, 2));

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
