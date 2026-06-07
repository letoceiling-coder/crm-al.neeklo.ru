import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProviderAccountsService } from './provider-accounts.service';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateProviderAccountDto, UpdateProviderAccountDto } from './dto/provider-accounts.dto';

@Controller('v1/provider-accounts')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ProviderAccountsController {
  constructor(private service: ProviderAccountsService) {}

  @Get()
  findAll(@CurrentTenant() tenant: TenantContext) {
    return this.service.findAll(tenant);
  }

  @Post()
  create(@CurrentTenant() tenant: TenantContext, @Body() dto: CreateProviderAccountDto) {
    return this.service.create(tenant, dto);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateProviderAccountDto,
  ) {
    return this.service.update(tenant, id, dto);
  }

  @Post(':id/set-default')
  setDefault(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.setDefault(tenant, id);
  }

  @Post(':id/test')
  test(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.service.testConnection(tenant, id);
  }
}
