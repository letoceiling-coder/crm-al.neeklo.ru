import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ModelsService } from './models.service';
import { ModelsQueryDto } from './dto/models-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

@Controller('models')
@UseGuards(AuthGuard('jwt'))
export class ModelsController {
  constructor(private modelsService: ModelsService) {}

  @Get()
  findAll(@Query() query: ModelsQueryDto) {
    const { search, provider, label, ...pagination } = query;
    return this.modelsService.findAll(pagination, {
      provider: provider || undefined,
      label: label || undefined,
      search: search || undefined,
      enabledOnly: true,
      unlimited: true,
    });
  }

  @Get('providers')
  getProviders() {
    return this.modelsService.getProviders();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.modelsService.findOne(id);
  }
}

@Controller('admin/models')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class ModelsAdminController {
  constructor(private modelsService: ModelsService) {}

  @Get()
  findAll(@Query() query: ModelsQueryDto) {
    const { search, provider, label, ...pagination } = query;
    return this.modelsService.findAll(pagination, {
      provider: provider || undefined,
      label: label || undefined,
      search: search || undefined,
      unlimited: true,
    });
  }

  @Post('sync')
  sync(@Req() req: Request & { user: { id: string } }) {
    return this.modelsService.syncFromOpenRouter(req.user.id);
  }

  @Put(':id/toggle')
  toggle(
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.modelsService.toggleEnabled(id, enabled, req.user.id);
  }

  @Get('fallback/global')
  getFallback() {
    return this.modelsService.getGlobalFallback();
  }

  @Put('fallback/global')
  setFallback(
    @Body('modelIds') modelIds: string[],
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.modelsService.setGlobalFallback(modelIds, req.user.id);
  }
}
