import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../common/guards/admin.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../common/decorators';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { SupportDashboardService, BackupCenterService } from './support.service';

@ApiTags('support')
@Controller('v1/support')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class SupportController {
  constructor(private support: SupportDashboardService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Support dashboard overview' })
  getDashboard() {
    return this.support.getOverview();
  }
}

@ApiTags('backups')
@Controller('v1/backups')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class BackupController {
  constructor(private backups: BackupCenterService) {}

  @Get('status')
  @ApiOperation({ summary: 'Backup center status' })
  getStatus(@CurrentTenant() _tenant: TenantContext) {
    return this.backups.getStatus();
  }
}

@ApiTags('legal')
@Controller('v1/legal')
export class LegalController {
  @Get('documents')
  @ApiOperation({ summary: 'Legal document list' })
  listDocuments() {
    return [
      { slug: 'terms', title: 'Terms of Service', path: '/legal/terms' },
      { slug: 'privacy', title: 'Privacy Policy', path: '/legal/privacy' },
      { slug: 'cookies', title: 'Cookie Policy', path: '/legal/cookies' },
      { slug: 'dpa', title: 'Data Processing Agreement', path: '/legal/dpa' },
      { slug: 'marketplace-publisher', title: 'Marketplace Publisher Agreement', path: '/legal/marketplace-publisher' },
    ];
  }
}
