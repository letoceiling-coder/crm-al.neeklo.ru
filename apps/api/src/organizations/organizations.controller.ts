import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrganizationsService } from './organizations.service';
import { AuthService } from '../auth/auth.service';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { UpdateOrganizationDto } from './dto/organizations.dto';

@Controller('v1/organizations')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class OrganizationsController {
  constructor(
    private organizations: OrganizationsService,
    private auth: AuthService,
  ) {}

  @Get('current')
  getCurrent(@CurrentTenant() tenant: TenantContext) {
    return this.organizations.getCurrentOrganization(tenant.userId, tenant.organizationId);
  }

  @Patch('current')
  updateCurrent(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.updateOrganization(tenant, dto);
  }

  @Get('current/members')
  listMembers(@CurrentTenant() tenant: TenantContext) {
    return this.organizations.listMembers(tenant.userId, tenant.organizationId);
  }

  @Post('switch/:orgId')
  async switchOrg(
    @Req() req: { user: { id: string } },
    @Param('orgId') orgId: string,
  ) {
    const result = await this.organizations.switchOrganization(req.user.id, orgId);
    const accessToken = await this.auth.issueAccessToken(req.user.id);
    return { ...result, accessToken };
  }
}
