import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { KeyModelProfilesService } from './key-model-profiles.service';
import {
  CreateKeyModelProfileDto,
  UpdateKeyModelProfileDto,
} from './dto/key-model-profiles.dto';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

@Controller('key-model-profiles')
@UseGuards(AuthGuard('jwt'))
export class KeyModelProfilesController {
  constructor(private profilesService: KeyModelProfilesService) {}

  @Get()
  findAll(@Req() req: Request & { user: { id: string } }) {
    return this.profilesService.findAllForUser(req.user.id);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.profilesService.findOne(id, req.user.id, req.user.role);
  }

  @Post()
  create(
    @Body() dto: CreateKeyModelProfileDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    return this.profilesService.create(req.user.id, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateKeyModelProfileDto,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.profilesService.update(id, req.user.id, req.user.role, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user: { id: string; role: UserRole } },
  ) {
    return this.profilesService.remove(id, req.user.id, req.user.role);
  }
}
