import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ToolInstanceService } from './tool-instance.service';
import { ToolExecutionService } from './tool-execution.service';
import {
  CreateToolInstanceDto,
  UpdateToolInstanceDto,
  SetToolSecretDto,
  ExecuteToolDto,
} from './dto/tool.dto';

@ApiTags('Tool Instances')
@ApiBearerAuth()
@Controller('v1/tools/instances')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ToolsInstancesController {
  constructor(
    private instances: ToolInstanceService,
    private execution: ToolExecutionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List organization tool instances' })
  list(@CurrentTenant() tenant: TenantContext) {
    return this.instances.list(tenant);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tool instance' })
  get(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.instances.findOne(tenant, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create tool instance from catalog' })
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateToolInstanceDto) {
    return this.instances.create(tenant, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tool instance' })
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateToolInstanceDto,
  ) {
    return this.instances.update(tenant, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tool instance' })
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.instances.remove(tenant, id);
  }

  @Post(':id/secrets')
  @ApiOperation({ summary: 'Set or rotate tool secret' })
  setSecret(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SetToolSecretDto,
  ) {
    return this.instances.setSecret(tenant, id, dto);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test tool connection' })
  test(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.execution.testConnection(tenant, id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute tool manually' })
  execute(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ExecuteToolDto,
  ) {
    return this.execution.execute(tenant, id, dto.input ?? {}, undefined, { action: dto.action });
  }
}
