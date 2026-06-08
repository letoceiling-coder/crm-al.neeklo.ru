import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrganizationsService } from './organizations.service';
import { OrganizationMembersService } from './organization-members.service';
import { AuthService } from '../auth/auth.service';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { UpdateOrganizationDto } from './dto/organizations.dto';
import { InviteMemberDto, UpdateMemberRoleDto } from '../billing/dto/billing.dto';

@Controller('v1/organizations')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class OrganizationsController {
  constructor(
    private organizations: OrganizationsService,
    private members: OrganizationMembersService,
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

  @Post('current/members/invite')
  inviteMember(@CurrentTenant() tenant: TenantContext, @Body() dto: InviteMemberDto) {
    return this.members.invite(tenant, dto.email, dto.role);
  }

  @Get('current/invitations')
  listInvitations(@CurrentTenant() tenant: TenantContext) {
    return this.members.listInvitations(tenant);
  }

  @Delete('current/invitations/:id')
  revokeInvitation(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.members.revokeInvitation(tenant, id);
  }

  @Patch('current/members/:id')
  updateMemberRole(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.members.updateMemberRole(tenant, id, dto.role);
  }

  @Delete('current/members/:id')
  removeMember(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.members.removeMember(tenant, id);
  }

  @Post('invitations/accept')
  acceptInvitation(
    @Req() req: { user: { id: string; email: string } },
    @Body() body: { token: string },
  ) {
    return this.members.acceptInvitation(req.user.id, req.user.email, body.token);
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
