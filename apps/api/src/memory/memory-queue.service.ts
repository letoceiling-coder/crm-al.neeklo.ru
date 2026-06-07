import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import type { MemorySummarizeJobPayload } from './memory-summarize.service';

@Injectable()
export class MemoryQueueService {
  constructor(@InjectQueue(QUEUE_NAMES.MEMORY_SUMMARIZE) private summarizeQueue: Queue) {}

  async enqueueSummarize(payload: MemorySummarizeJobPayload) {
    return this.summarizeQueue.add(JOB_NAMES.MEMORY_SUMMARIZE, payload, {
      removeOnComplete: 100,
      removeOnFail: false,
    });
  }
}
