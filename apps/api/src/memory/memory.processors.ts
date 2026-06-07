import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import { MemorySummarizeService, MemorySummarizeJobPayload } from './memory-summarize.service';

@Processor(QUEUE_NAMES.MEMORY_SUMMARIZE)
export class MemorySummarizeProcessor extends WorkerHost {
  constructor(private summarize: MemorySummarizeService) {
    super();
  }

  async process(job: Job) {
    if (job.name === JOB_NAMES.MEMORY_SUMMARIZE) {
      return this.summarize.run(job.data as MemorySummarizeJobPayload);
    }
  }
}
