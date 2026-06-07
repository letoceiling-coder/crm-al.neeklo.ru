import { Injectable, Logger } from '@nestjs/common';
import AdmZip = require('adm-zip');
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { KnowledgeDocumentFormat, KnowledgeDocumentStatus } from '@prisma/client';
import { formatFromMime } from '../knowledge.utils';
import { randomUUID } from 'crypto';

export interface ExtractedFile {
  path: string;
  buffer: Buffer;
  format: KnowledgeDocumentFormat;
}

@Injectable()
export class ZipExtractionService {
  private readonly logger = new Logger(ZipExtractionService.name);

  constructor(
    private storage: StorageService,
    private prisma: PrismaService,
  ) {}

  extract(buffer: Buffer): ExtractedFile[] {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const out: ExtractedFile[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName;
      const lower = name.toLowerCase();
      if (!/\.(pdf|docx|txt|md|markdown)$/.test(lower)) continue;

      const data = entry.getData();
      const formatStr = formatFromMime('', name.split('/').pop() ?? name);
      out.push({
        path: name,
        buffer: data,
        format: formatStr as KnowledgeDocumentFormat,
      });
    }
    return out;
  }

  async extractFromS3AndCreateDocuments(params: {
    organizationId: string;
    knowledgeBaseId: string;
    parentDocumentId: string;
    rawS3Key: string;
    knowledgeSourceId?: string;
  }): Promise<string[]> {
    const buffer = await this.storage.download(params.rawS3Key);
    const files = this.extract(buffer);
    const docIds: string[] = [];

    for (const file of files) {
      const docId = randomUUID();
      const rawKey = this.storage.buildKey(
        params.organizationId,
        'raw',
        params.knowledgeBaseId,
        docId,
        file.path.replace(/\//g, '_'),
      );

      await this.storage.upload({
        key: rawKey,
        body: file.buffer,
        contentType: 'application/octet-stream',
      });

      await this.prisma.knowledgeDocument.create({
        data: {
          id: docId,
          organizationId: params.organizationId,
          knowledgeBaseId: params.knowledgeBaseId,
          knowledgeSourceId: params.knowledgeSourceId,
          title: file.path.split('/').pop() ?? file.path,
          format: file.format,
          status: KnowledgeDocumentStatus.PENDING,
          rawS3Key: rawKey,
          metadata: { zipParentId: params.parentDocumentId, zipPath: file.path },
        },
      });
      docIds.push(docId);
    }

    this.logger.log(`Extracted ${docIds.length} files from ZIP ${params.parentDocumentId}`);
    return docIds;
  }
}
