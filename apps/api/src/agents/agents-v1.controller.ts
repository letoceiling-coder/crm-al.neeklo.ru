import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { Public } from '../common/decorators';
import { ApiKeyOrJwtGuard } from '../common/guards/api-key-or-jwt.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@Controller('v1/agents')
@Public()
@UseGuards(ApiKeyOrJwtGuard)
export class AgentsV1Controller {
  constructor(private agentsService: AgentsService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.agentsService.findAll(query, true);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.agentsService.findOne(id);
  }
}
