import { Injectable, Logger, NotFoundException, Inject, forwardRef, Optional } from '@nestjs/common';

import {

  KnowledgeEmbeddingStatus,

  KnowledgeExtractedEntityType,

  KnowledgeHistoryEventType,

  KnowledgeTagSuggestionStatus,

  PipelineRunStatus,

  PipelineStageStatus,

  PipelineStageType,

} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { StorageService } from '../../storage/storage.service';

import { KnowledgeQueueService } from '../../knowledge/jobs/knowledge-queue.service';

import { KnowledgePlanLimitsService } from '../../knowledge/knowledge-plan-limits.service';

import { slugify } from '../../common/utils/slug.util';

import { StageLlmExecutorService } from './stage-llm-executor.service';

import { SemanticChunkingService } from '../chunking/semantic-chunking.service';

import { DocumentPreChunkService, DocumentPreChunk } from '../chunking/document-pre-chunk.service';

import { PipelineRunService, CreateRunParams } from './pipeline-run.service';

import { KqsService } from '../kqs/kqs.service';

import {

  EnrichmentPipelineContext,

  LLM_STAGES,

  normalizeEntityName,

  truncateForLlm,

  StageLlmResult,

} from './pipeline-context.types';

import { PipelineJobPayload } from './agentcrm-orchestrator.service';

import { LARGE_DOC_THRESHOLD_CHARS, MICRO_CHUNK_CONCURRENCY, MICRO_CHUNK_STAGGER_MS } from './large-doc.constants';

import { EntityMergeService } from './merge/entity-merge.service';

import { ClassificationMergeService } from './merge/classification-merge.service';

import { StructureMergeService } from './merge/structure-merge.service';

import { HierarchicalSummaryService } from './summary/hierarchical-summary.service';
import { SecondOpinionValidationService } from './validation/second-opinion-validation.service';
import { AutoTaxonomyService } from './auto-taxonomy.service';
import { KnowledgeHistoryService } from '../../knowledge/knowledge-history.service';



const MICRO_STAGES: PipelineStageType[] = [

  PipelineStageType.CLEANING,

  PipelineStageType.STRUCTURE,

  PipelineStageType.CLASSIFICATION,

  PipelineStageType.ENTITY_EXTRACTION,

];



const DOC_LEVEL_STAGES: PipelineStageType[] = [

  PipelineStageType.SUMMARY,

  PipelineStageType.TAGGING,

  PipelineStageType.VALIDATION,

];



interface MicroChunkState {

  preChunkIndex: number;

  preChunkHash: string;

  cleanText: string;

  structureJson?: Record<string, unknown>;

  classificationJson?: Record<string, unknown>;

  entitiesJson?: Record<string, unknown>;

}



@Injectable()

export class EnrichmentPipelineService {

  private readonly logger = new Logger(EnrichmentPipelineService.name);



  constructor(

    private prisma: PrismaService,

    private storage: StorageService,

    private llm: StageLlmExecutorService,

    private semantic: SemanticChunkingService,

    private preChunk: DocumentPreChunkService,

    private entityMerge: EntityMergeService,

    private classificationMerge: ClassificationMergeService,

    private structureMerge: StructureMergeService,

    private hierarchicalSummary: HierarchicalSummaryService,

    private secondOpinion: SecondOpinionValidationService,

    private runs: PipelineRunService,

    private kqs: KqsService,

    private limits: KnowledgePlanLimitsService,

    private autoTaxonomy: AutoTaxonomyService,

    @Optional()

    @Inject(forwardRef(() => KnowledgeQueueService))

    private knowledgeQueue?: KnowledgeQueueService,

    @Optional()

    private historyService?: KnowledgeHistoryService,

  ) {}



  async execute(payload: PipelineJobPayload, bullJobId?: string): Promise<{ runId: string; status: PipelineRunStatus }> {

    const doc = await this.prisma.knowledgeDocument.findUnique({

      where: { id: payload.documentId },

      include: {

        versions: { orderBy: { version: 'desc' }, take: 1 },

        knowledgeBase: {

          include: {

            categories: { select: { id: true, name: true, slug: true } },

            topics: { select: { id: true, name: true, slug: true, categoryId: true } },

            tags: { select: { id: true, name: true, slug: true } },

          },

        },

      },

    });

    if (!doc?.processedS3Key) throw new NotFoundException('Document not ready for enrichment');

    void this.historyService?.record({
      organizationId: payload.organizationId,
      knowledgeBaseId: payload.knowledgeBaseId,
      documentId: payload.documentId,
      eventType: KnowledgeHistoryEventType.ENRICHMENT_STARTED,
    });



    const rawText = await this.loadText(doc.processedS3Key);

    const contentHash = payload.contentHash || this.runs.contentHashFromText(rawText);



    let runId = payload.runId;

    if (!runId) {

      const run = await this.runs.createRun({

        organizationId: payload.organizationId,

        knowledgeBaseId: payload.knowledgeBaseId,

        documentId: payload.documentId,

        documentVersionId: payload.documentVersionId ?? doc.versions[0]?.id,

        contentHash,

        bullJobId,

      } as CreateRunParams);

      runId = run.id;

    }



    const useMicro = rawText.length > LARGE_DOC_THRESHOLD_CHARS;

    this.logger.log(

      `Pipeline doc=${payload.documentId} mode=${useMicro ? 'micro' : 'monolithic'} chars=${rawText.length}`,

    );



    let ctx: EnrichmentPipelineContext = {

      organizationId: payload.organizationId,

      knowledgeBaseId: payload.knowledgeBaseId,

      documentId: payload.documentId,

      documentVersionId: payload.documentVersionId ?? doc.versions[0]?.id,

      runId,

      contentHash,

      rawText,

      cleanText: rawText,

      pipelineMode: useMicro ? 'micro' : 'monolithic',

    };



    let runStatus: PipelineRunStatus = PipelineRunStatus.SUCCESS;



    if (useMicro) {

      const microResult = await this.runMicroPipeline(ctx, doc.knowledgeBase);

      ctx = microResult.ctx;

      if (microResult.hadFailures) runStatus = PipelineRunStatus.PARTIAL;

    } else {

      const monoResult = await this.runMonolithicLlmStages(ctx, doc.knowledgeBase);

      ctx = monoResult.ctx;

      if (monoResult.hadFailures) runStatus = PipelineRunStatus.PARTIAL;

    }



    const kqsResult = this.kqs.computeFromContext(ctx, rawText);

    ctx.qualityScore = kqsResult.score;

    ctx.qualityReasons = kqsResult.reasons;

    await this.kqs.persistRunScore(runId, kqsResult.score, {

      ...kqsResult.breakdown,

      qualityReasons: kqsResult.reasons,

    });



    await this.runs.markRunning(runId, PipelineStageType.SEMANTIC_CHUNKING);

    try {

      const chunkCount = await this.runSemanticChunking(ctx, doc);

      await this.runs.recordStageResult(runId, PipelineStageType.SEMANTIC_CHUNKING, {

        status: PipelineStageStatus.SUCCESS,

        outputJson: { chunkCount, strategy: 'SEMANTIC', pipelineMode: ctx.pipelineMode },

      });

    } catch (err) {

      runStatus = PipelineRunStatus.PARTIAL;

      await this.runs.recordStageResult(runId, PipelineStageType.SEMANTIC_CHUNKING, {

        status: PipelineStageStatus.FAILED,

        error: (err as Error).message,

      });

    }



    await this.runs.markRunning(runId, PipelineStageType.EMBEDDING);

    try {

      if (this.knowledgeQueue) {

        await this.knowledgeQueue.enqueueEmbed({

          organizationId: payload.organizationId,

          knowledgeBaseId: payload.knowledgeBaseId,

          documentId: payload.documentId,

        });

      }

      await this.runs.recordStageResult(runId, PipelineStageType.EMBEDDING, {

        status: PipelineStageStatus.SUCCESS,

        outputJson: { enqueued: true },

      });

    } catch (err) {

      runStatus = PipelineRunStatus.PARTIAL;

      await this.runs.recordStageResult(runId, PipelineStageType.EMBEDDING, {

        status: PipelineStageStatus.FAILED,

        error: (err as Error).message,

      });

    }



    await this.persistDocumentEnrichment(ctx);

    await this.autoTaxonomy.applyFromContext(ctx);

    void this.historyService?.record({
      organizationId: payload.organizationId,
      knowledgeBaseId: payload.knowledgeBaseId,
      documentId: payload.documentId,
      eventType:
        runStatus === PipelineRunStatus.SUCCESS
          ? KnowledgeHistoryEventType.ENRICHMENT_COMPLETED
          : KnowledgeHistoryEventType.ENRICHMENT_FAILED,
      data: { runId, status: runStatus, qualityScore: ctx.qualityScore },
    });

    await this.kqs.refreshKbAggregate(payload.knowledgeBaseId);

    await this.kqs.refreshOrgAggregate(

      payload.organizationId,

      new Date().toISOString().slice(0, 7),

    );

    await this.runs.finishRun(runId, runStatus);



    return { runId, status: runStatus };

  }



  private async runMonolithicLlmStages(

    ctx: EnrichmentPipelineContext,

    kb: Parameters<EnrichmentPipelineService['runLlmStage']>[2],

  ): Promise<{ ctx: EnrichmentPipelineContext; hadFailures: boolean }> {

    let hadFailures = false;

    for (const stage of LLM_STAGES) {

      await this.runs.markRunning(ctx.runId, stage);

      try {

        const result = await this.runLlmStage(stage, ctx, kb);

        const handled = await this.processLlmStageResult(stage, ctx, result);

        ctx = handled.ctx;

        if (handled.hadFailure) hadFailures = true;

      } catch (err) {

        this.logger.error(`Stage ${stage} failed: ${(err as Error).message}`);

        hadFailures = true;

        await this.runs.recordStageResult(ctx.runId, stage, {

          status: PipelineStageStatus.FAILED,

          error: (err as Error).message,

        });

      }

    }

    return { ctx, hadFailures };

  }



  private isReviewRequired(result: StageLlmResult): boolean {
    return (
      result.modelUsed === 'REVIEW_REQUIRED' ||
      !!(result.output?.reviewRequired as boolean | undefined)
    );
  }

  private async processLlmStageResult(
    stage: PipelineStageType,
    ctx: EnrichmentPipelineContext,
    result: StageLlmResult,
  ): Promise<{ ctx: EnrichmentPipelineContext; hadFailure: boolean }> {
    if (this.isReviewRequired(result)) {
      const reason = String(result.output?.reason ?? 'review required');
      await this.runs.recordStageResult(ctx.runId, stage, {
        status: PipelineStageStatus.FAILED,
        modelUsed: 'REVIEW_REQUIRED',
        outputJson: result.output,
        error: reason,
        fallbackIndex: result.fallbackIndex,
        outputSchemaVersion: result.outputSchemaVersion,
      });
      const reasons = [...(ctx.qualityReasons ?? []), `REVIEW_REQUIRED:${stage}`];
      return { ctx: { ...ctx, qualityReasons: reasons }, hadFailure: true };
    }

    const nextCtx = await this.applyStageOutput(stage, ctx, result.output);
    await this.recordLlmSuccess(ctx.runId, stage, result);
    const withOpinion = await this.applySecondOpinion(stage, nextCtx, result.output);
    return { ctx: withOpinion, hadFailure: false };
  }

  private async applySecondOpinion(
    stage: PipelineStageType,
    ctx: EnrichmentPipelineContext,
    primaryOutput: Record<string, unknown>,
  ): Promise<EnrichmentPipelineContext> {
    if (!this.secondOpinion.isCriticalStage(stage)) return ctx;
    const opinion = await this.secondOpinion.validateStage(stage, ctx, primaryOutput);
    if (!opinion) return ctx;

    const reviews = { ...(ctx.validationJson ?? {}), secondOpinion: { ...(ctx.validationJson?.secondOpinion as object ?? {}), [stage]: opinion } };
    const reasons = [...(ctx.qualityReasons ?? [])];
    if (opinion.reviewRequired) {
      reasons.push(`REVIEW_REQUIRED:${stage}`);
    }

    return { ...ctx, validationJson: reviews, qualityReasons: reasons };
  }



  private async runMicroPipeline(

    ctx: EnrichmentPipelineContext,

    kb: Parameters<EnrichmentPipelineService['runLlmStage']>[2],

  ): Promise<{ ctx: EnrichmentPipelineContext; hadFailures: boolean }> {

    const chunks = this.preChunk.split(ctx.rawText);

    ctx.preChunkCount = chunks.length;



    const microStates: MicroChunkState[] = [];

    let microSuccess = 0;

    let microFailed = 0;

    let totalInputTokens = 0;

    let totalOutputTokens = 0;

    let totalCost = 0;

    let totalLatency = 0;



    const processPreChunk = async (pc: DocumentPreChunk): Promise<MicroChunkState> => {
      let state: MicroChunkState = {
        preChunkIndex: pc.preChunkIndex,
        preChunkHash: pc.preChunkHash,
        cleanText: pc.text,
      };
      for (const stage of MICRO_STAGES) {
        await this.runs.markRunning(ctx.runId, stage);
        try {
          const result = await this.runLlmStage(stage, {
            ...ctx,
            rawText: pc.text,
            cleanText: state.cleanText,
            contentHash: pc.preChunkHash,
          }, kb, pc.preChunkIndex);
          if (this.isReviewRequired(result)) {
            microFailed += 1;
            this.logger.warn(
              `Micro stage ${stage} preChunk=${pc.preChunkIndex} review required: ${result.output?.reason ?? 'unknown'}`,
            );
            continue;
          }
          state = this.applyMicroStageOutput(stage, state, result.output);
          totalInputTokens += result.inputTokens;
          totalOutputTokens += result.outputTokens;
          totalCost += result.costUsd;
          totalLatency += result.latencyMs;
          microSuccess += 1;
        } catch (err) {
          microFailed += 1;
          this.logger.warn(
            `Micro stage ${stage} preChunk=${pc.preChunkIndex} failed: ${(err as Error).message}`,
          );
        }
      }
      return state;
    };

    for (let i = 0; i < chunks.length; i += MICRO_CHUNK_CONCURRENCY) {
      const batch = chunks.slice(i, i + MICRO_CHUNK_CONCURRENCY);
      const batchResults = await Promise.all(batch.map((pc) => processPreChunk(pc)));
      microStates.push(...batchResults);
      if (i + MICRO_CHUNK_CONCURRENCY < chunks.length && MICRO_CHUNK_STAGGER_MS > 0) {
        await new Promise((r) => setTimeout(r, MICRO_CHUNK_STAGGER_MS));
      }
    }

    microStates.sort((a, b) => a.preChunkIndex - b.preChunkIndex);

    ctx.cleanText = microStates.map((s) => s.cleanText).join('\n\n');

    ctx.structureJson = this.structureMerge.merge(microStates);

    ctx.classificationJson = this.classificationMerge.merge(microStates);

    const mergedEntities = this.entityMerge.merge(microStates);

    ctx.entitiesJson = { entities: mergedEntities.entities };

    await this.storeEntities(ctx, ctx.entitiesJson);



    ctx.microPipelineStats = {

      preChunkCount: chunks.length,

      microStageSuccess: microSuccess,

      microStageFailed: microFailed,

      microSuccessRate: microSuccess + microFailed > 0 ? microSuccess / (microSuccess + microFailed) : 0,

      totalInputTokens,

      totalOutputTokens,

      totalCostUsd: totalCost,
      avgLatencyMs: microSuccess > 0 ? totalLatency / microSuccess : 0,
      microConcurrency: MICRO_CHUNK_CONCURRENCY,
    };

    for (const stage of MICRO_STAGES) {

      await this.runs.recordStageResult(ctx.runId, stage, {

        status: microFailed === 0 ? PipelineStageStatus.SUCCESS : PipelineStageStatus.SUCCESS,

        outputJson: {

          mode: 'micro',

          preChunkCount: chunks.length,

          ...ctx.microPipelineStats,

        },

      });

    }



    let hadFailures = microFailed > 0;



    for (const stage of DOC_LEVEL_STAGES) {

      await this.runs.markRunning(ctx.runId, stage);

      try {

        let result: StageLlmResult;

        if (stage === PipelineStageType.SUMMARY) {

          result = await this.hierarchicalSummary.summarizeDocument({

            organizationId: ctx.organizationId,

            knowledgeBaseId: ctx.knowledgeBaseId,

            contentHash: ctx.contentHash,

            preChunks: microStates,

            merged: {

              structureJson: ctx.structureJson,

              classificationJson: ctx.classificationJson,

              entitiesJson: ctx.entitiesJson,

            },

            llm: this.llm,

          });

        } else {

          result = await this.runLlmStage(stage, ctx, kb);

        }

        const handled = await this.processLlmStageResult(stage, ctx, result);

        ctx = handled.ctx;

        if (handled.hadFailure) hadFailures = true;

      } catch (err) {

        hadFailures = true;

        this.logger.error(`Doc-level stage ${stage} failed: ${(err as Error).message}`);

        await this.runs.recordStageResult(ctx.runId, stage, {

          status: PipelineStageStatus.FAILED,

          error: (err as Error).message,

        });

      }

    }



    return { ctx, hadFailures };

  }



  private applyMicroStageOutput(

    stage: PipelineStageType,

    state: MicroChunkState,

    output: Record<string, unknown>,

  ): MicroChunkState {

    switch (stage) {

      case PipelineStageType.CLEANING:

        return { ...state, cleanText: String(output.cleanText ?? output.text ?? state.cleanText) };

      case PipelineStageType.STRUCTURE:

        return { ...state, structureJson: output };

      case PipelineStageType.CLASSIFICATION:

        return { ...state, classificationJson: output };

      case PipelineStageType.ENTITY_EXTRACTION:

        return { ...state, entitiesJson: output };

      default:

        return state;

    }

  }



  private async recordLlmSuccess(runId: string, stage: PipelineStageType, result: StageLlmResult) {

    await this.runs.recordStageResult(runId, stage, {

      status: PipelineStageStatus.SUCCESS,

      modelId: result.modelId || undefined,

      modelUsed: result.modelUsed,

      inputTokens: result.inputTokens,

      outputTokens: result.outputTokens,

      costUsd: result.costUsd,

      latencyMs: result.latencyMs,

      cacheHit: result.cacheHit,

      fallbackIndex: result.fallbackIndex,

      outputSchemaVersion: result.outputSchemaVersion,

      outputJson: result.output,

    });

  }



  private async loadText(s3Key: string): Promise<string> {

    const buf = await this.storage.download(s3Key);

    return buf.toString('utf-8');

  }



  private async runLlmStage(

    stage: PipelineStageType,

    ctx: EnrichmentPipelineContext,

    kb: {

      categories: { id: string; name: string; slug: string }[];

      topics: { id: string; name: string; slug: string; categoryId: string }[];

      tags: { id: string; name: string; slug: string }[];

    },

    preChunkIndex?: number,

  ) {

    const text = truncateForLlm(ctx.cleanText || ctx.rawText);

    let userPrompt = text;



    if (stage === PipelineStageType.CLASSIFICATION) {

      userPrompt = `Taxonomy options: ${JSON.stringify({ categories: kb.categories, topics: kb.topics })}\n\nDocument:\n${text}`;

    } else if (stage === PipelineStageType.TAGGING) {

      userPrompt = `Existing tags: ${JSON.stringify(kb.tags.map((t) => t.name))}\n\nDocument:\n${truncateForLlm(ctx.cleanText, 12_000)}`;

    } else if (stage === PipelineStageType.VALIDATION) {

      userPrompt = JSON.stringify({

        length: ctx.rawText.length,

        preChunkCount: ctx.preChunkCount,

        pipelineMode: ctx.pipelineMode,

        structure: ctx.structureJson,

        classification: ctx.classificationJson,

        entities: ctx.entitiesJson,

        summary: ctx.summaryJson,

      });

    }



    if (preChunkIndex !== undefined) {

      userPrompt = `[preChunk ${preChunkIndex + 1}]\n${userPrompt}`;

    }



    return this.llm.executeStage({

      stage,

      organizationId: ctx.organizationId,

      knowledgeBaseId: ctx.knowledgeBaseId,

      contentHash: ctx.contentHash,

      userPrompt,

    });

  }



  private async applyStageOutput(

    stage: PipelineStageType,

    ctx: EnrichmentPipelineContext,

    output: Record<string, unknown>,

  ): Promise<EnrichmentPipelineContext> {

    switch (stage) {

      case PipelineStageType.CLEANING:

        return {

          ...ctx,

          cleanText: String(output.cleanText ?? output.text ?? ctx.cleanText),

        };

      case PipelineStageType.STRUCTURE:

        return { ...ctx, structureJson: output };

      case PipelineStageType.CLASSIFICATION:

        return { ...ctx, classificationJson: output };

      case PipelineStageType.ENTITY_EXTRACTION:

        await this.storeEntities(ctx, output);

        return { ...ctx, entitiesJson: output };

      case PipelineStageType.SUMMARY:

        return { ...ctx, summaryJson: output };

      case PipelineStageType.TAGGING:

        await this.storeTagSuggestions(ctx, output);

        return { ...ctx, taggingJson: output };

      case PipelineStageType.VALIDATION:

        return { ...ctx, validationJson: output };

      default:

        return ctx;

    }

  }



  private async storeEntities(ctx: EnrichmentPipelineContext, output: Record<string, unknown>) {

    const list = Array.isArray(output.entities) ? output.entities : [];

    await this.prisma.knowledgeExtractedEntity.deleteMany({ where: { documentId: ctx.documentId, runId: ctx.runId } });

    for (const item of list) {

      const row = item as Record<string, unknown>;

      const name = String(row.name ?? row.value ?? '').trim();

      if (!name) continue;

      const type = String(row.type ?? 'CUSTOM').toUpperCase() as KnowledgeExtractedEntityType;

      const entityType = Object.values(KnowledgeExtractedEntityType).includes(type)

        ? type

        : KnowledgeExtractedEntityType.CUSTOM;

      await this.prisma.knowledgeExtractedEntity.create({

        data: {

          organizationId: ctx.organizationId,

          knowledgeBaseId: ctx.knowledgeBaseId,

          documentId: ctx.documentId,

          runId: ctx.runId,

          entityType,

          name,

          normalizedName: normalizeEntityName(name),

          value: row.value ? String(row.value) : null,

          confidence: Number(row.confidence ?? 0.8),

          metadata: row as object,

        },

      });

    }

  }



  private async storeTagSuggestions(ctx: EnrichmentPipelineContext, output: Record<string, unknown>) {

    const list = Array.isArray(output.suggestedTags) ? output.suggestedTags : [];

    const threshold = 0.75;

    for (const item of list) {

      const row = item as Record<string, unknown>;

      const tagName = String(row.name ?? row.tag ?? '').trim();

      if (!tagName) continue;

      const confidence = Number(row.confidence ?? 0.5);

      const suggestion = await this.prisma.knowledgeTagSuggestion.create({

        data: {

          organizationId: ctx.organizationId,

          knowledgeBaseId: ctx.knowledgeBaseId,

          documentId: ctx.documentId,

          runId: ctx.runId,

          tagName,

          confidence,

          status:

            confidence >= threshold

              ? KnowledgeTagSuggestionStatus.APPROVED

              : KnowledgeTagSuggestionStatus.PENDING,

        },

      });

      if (confidence >= threshold) {

        const slug = slugify(tagName);

        const tag = await this.prisma.knowledgeTag.upsert({

          where: { knowledgeBaseId_slug: { knowledgeBaseId: ctx.knowledgeBaseId, slug } },

          create: {

            organizationId: ctx.organizationId,

            knowledgeBaseId: ctx.knowledgeBaseId,

            name: tagName,

            slug,

          },

          update: {},

        });

        await this.prisma.knowledgeDocumentTag.upsert({

          where: { documentId_tagId: { documentId: ctx.documentId, tagId: tag.id } },

          create: { documentId: ctx.documentId, tagId: tag.id },

          update: {},

        });

        await this.prisma.knowledgeTagSuggestion.update({

          where: { id: suggestion.id },

          data: { status: KnowledgeTagSuggestionStatus.APPROVED, reviewedAt: new Date() },

        });

      }

    }

  }



  private async runSemanticChunking(

    ctx: EnrichmentPipelineContext,

    doc: { id: string; organizationId: string; knowledgeBaseId: string; versions: { id: string }[] },

  ): Promise<number> {

    const versionId = ctx.documentVersionId ?? doc.versions[0]?.id;

    if (!versionId) throw new Error('No document version');



    const pieces = this.semantic.chunkFromStructure(ctx.cleanText, ctx.structureJson);

    await this.limits.assertCanCreateChunks(ctx.organizationId, pieces.length);

    await this.prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id, versionId } });



    const chunkIds: string[] = [];

    for (let i = 0; i < pieces.length; i++) {

      const piece = pieces[i];

      const chunk = await this.prisma.knowledgeChunk.create({

        data: {

          organizationId: ctx.organizationId,

          knowledgeBaseId: ctx.knowledgeBaseId,

          documentId: doc.id,

          versionId,

          chunkIndex: i,

          content: piece.content,

          charCount: piece.charCount,

          tokenCount: piece.tokenCount,

          metadata: (piece.metadata ?? { strategy: 'SEMANTIC' }) as object,

        },

      });

      chunkIds.push(chunk.id);

    }



    await this.prisma.knowledgeDocument.update({

      where: { id: doc.id },

      data: {

        chunkCount: chunkIds.length,

        embeddingStatus: KnowledgeEmbeddingStatus.EMBEDDING,

      },

    });



    return chunkIds.length;

  }



  private async persistDocumentEnrichment(ctx: EnrichmentPipelineContext) {

    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: ctx.documentId } });

    const meta = (doc?.metadata as Record<string, unknown>) ?? {};

    await this.prisma.knowledgeDocument.update({

      where: { id: ctx.documentId },

      data: {

        metadata: {

          ...meta,

          pipelineVersion: 3,

          agentcrm: {

            runId: ctx.runId,

            qualityScore: ctx.qualityScore,

            qualityReasons: ctx.qualityReasons,

            pipelineMode: ctx.pipelineMode,

            preChunkCount: ctx.preChunkCount,

            microPipelineStats: ctx.microPipelineStats,

            structureJson: ctx.structureJson,

            classificationJson: ctx.classificationJson,

            summaryJson: ctx.summaryJson,

            entitiesJson: ctx.entitiesJson,

            taggingJson: ctx.taggingJson,

          },

        } as object,

      },

    });

  }

}


