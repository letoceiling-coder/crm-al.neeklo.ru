import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { ToolCatalogService } from './tool-catalog.service';

@ApiTags('Tools Catalog')
@ApiBearerAuth()
@Controller('v1/tools/catalog')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ToolsCatalogController {
  constructor(private catalog: ToolCatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List public tool definitions' })
  list() {
    return this.catalog.listDefinitions();
  }

  @Get('providers')
  @ApiOperation({ summary: 'List tool providers' })
  providers() {
    return this.catalog.listProviders();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get tool definition by slug' })
  get(@Param('slug') slug: string) {
    return this.catalog.getBySlug(slug);
  }
}
