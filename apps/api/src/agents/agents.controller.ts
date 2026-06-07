import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto } from './dto/agents.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

@Controller('agents')
@UseGuards(AuthGuard('jwt'))
export class AgentsController {
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

@Controller('admin/agents')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AgentsAdminController {
  constructor(private agentsService: AgentsService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.agentsService.findAll(query);
  }

  @Post()
  create(
    @Body() dto: CreateAgentDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.agentsService.create(dto, req.user.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.agentsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.agentsService.remove(id, req.user.id);
  }
}
