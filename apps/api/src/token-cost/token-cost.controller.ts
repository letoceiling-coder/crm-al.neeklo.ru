import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { TokenCostService } from './token-cost.service';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTokenCostSnapshotDto } from './dto/token-cost.dto';

@Controller('admin/token-cost-snapshots')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class TokenCostAdminController {
  constructor(private service: TokenCostService) {}

  @Get()
  list(@Query('provider') provider?: string, @Query('model') model?: string) {
    return this.service.list(provider, model);
  }

  @Post()
  create(@Body() dto: CreateTokenCostSnapshotDto) {
    return this.service.create(dto);
  }

  @Post('sync')
  sync() {
    return this.service.syncFromModels();
  }
}
