import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from './api-keys.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  SetBalanceDto,
  TopUpApiKeyDto,
  TopUpQueryDto,
} from './dto/api-keys.dto';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

@Controller('api-keys')
@UseGuards(AuthGuard('jwt'))
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Get()
  findAll(@Req() req: Request & { user: { id: string; role: UserRole } }) {
    if (req.user.role === UserRole.ADMIN) {
      return this.apiKeysService.findAllAdmin();
    }
    return this.apiKeysService.findAllForUser(req.user.id);
  }

  @Get('stats')
  getStats(@Req() req: Request & { user: { id: string } }) {
    return this.apiKeysService.getStats(req.user.id);
  }

  @Get('top-ups/stats')
  topUpStats(
    @Query() query: TopUpQueryDto,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.getTopUpStats(req.user.id, req.user.role, query);
  }

  @Get('top-ups')
  topUps(
    @Query() query: TopUpQueryDto,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.listTopUps(req.user.id, req.user.role, query);
  }

  @Get(':id/balance')
  balance(
    @Param('id') id: string,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.getBalance(id, req.user.id, req.user.role);
  }

  @Get(':id/reveal')
  reveal(
    @Param('id') id: string,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.revealKey(id, req.user.id, req.user.role);
  }

  @Put(':id/balance')
  setBalance(
    @Param('id') id: string,
    @Body() dto: SetBalanceDto,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.setBalance(id, req.user.id, req.user.role, dto.balanceRub);
  }

  @Post(':id/top-up')
  topUp(
    @Param('id') id: string,
    @Body() dto: TopUpApiKeyDto,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.topUp(
      id,
      req.user.id,
      req.user.role,
      dto.amountRub,
      dto.comment,
    );
  }

  @Get(':id/top-ups')
  keyTopUps(
    @Param('id') id: string,
    @Query() query: TopUpQueryDto,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.listTopUps(req.user.id, req.user.role, {
      ...query,
      apiKeyId: id,
    });
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.findOne(id, req.user.id, req.user.role);
  }

  @Post()
  create(
    @Body() dto: CreateApiKeyDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.apiKeysService.create(req.user.id, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.update(id, req.user.id, req.user.role, dto);
  }

  @Post(':id/deactivate')
  deactivate(
    @Param('id') id: string,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.deactivate(id, req.user.id, req.user.role);
  }

  @Post(':id/regenerate')
  regenerate(
    @Param('id') id: string,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.apiKeysService.regenerate(id, req.user.id, req.user.role);
  }
}

@Controller('admin/api-keys')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class ApiKeysAdminController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Get()
  findAll() {
    return this.apiKeysService.findAllAdmin();
  }
}
