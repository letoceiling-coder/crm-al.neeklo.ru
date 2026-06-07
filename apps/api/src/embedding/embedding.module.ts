import { Module } from '@nestjs/common';
import { EmbeddingProfileService } from './embedding-profile.service';

@Module({
  providers: [EmbeddingProfileService],
  exports: [EmbeddingProfileService],
})
export class EmbeddingModule {}
