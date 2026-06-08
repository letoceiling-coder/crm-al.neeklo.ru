import { Module, Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../common/guards/admin.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { BillingModule } from '../billing/billing.module';
import { EnterpriseService } from './enterprise.service';
import { CreateEnterpriseContractDto } from './dto/enterprise.dto';

@Controller('v1/enterprise')
@UseGuards(AuthGuard('jwt'))
export class EnterpriseController {
  constructor(private enterprise: EnterpriseService) {}

  @Get('contract')
  @UseGuards(TenantGuard)
  getOwnContract(@CurrentTenant() tenant: TenantContext) {
    return this.enterprise.getByOrganization(tenant.organizationId);
  }

  @Get('contracts')
  @UseGuards(AdminGuard)
  listContracts() {
    return this.enterprise.list();
  }

  @Post('contracts')
  @UseGuards(AdminGuard)
  createContract(@Body() dto: CreateEnterpriseContractDto) {
    return this.enterprise.create(dto);
  }

  @Post('contracts/:id/activate')
  @UseGuards(AdminGuard)
  activate(@Param('id') id: string) {
    return this.enterprise.activate(id);
  }
}

@Module({
  imports: [BillingModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService],
  exports: [EnterpriseService],
})
export class EnterpriseModule {}
