import { Module } from '@nestjs/common';
import { ParserClientService } from './parser-client.service';

@Module({
  providers: [ParserClientService],
  exports: [ParserClientService],
})
export class ParserClientModule {}
