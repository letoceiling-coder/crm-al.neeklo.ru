import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuditAction, UserRole } from '@prisma/client';

@Controller('admin/audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('action') action?: AuditAction,
    @Query('userId') userId?: string,
  ) {
    return this.auditService.findAll(query, { action, userId });
  }
}
