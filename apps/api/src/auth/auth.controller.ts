import { Controller, Post, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators';
import { LoginDto, Enable2FaDto, UpdateThemeDto, ChangePasswordDto } from './dto/auth.dto';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  profile(@Req() req: Request & { user: { id: string } }) {
    return this.authService.getProfile(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/setup')
  setup2Fa(@Req() req: Request & { user: { id: string } }) {
    return this.authService.setup2Fa(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/enable')
  enable2Fa(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: Enable2FaDto,
  ) {
    return this.authService.enable2Fa(req.user.id, dto, req.ip);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/disable')
  disable2Fa(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: Enable2FaDto,
  ) {
    return this.authService.disable2Fa(req.user.id, dto, req.ip);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('theme')
  updateTheme(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: UpdateThemeDto,
  ) {
    return this.authService.updateTheme(req.user.id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('password')
  changePassword(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, dto);
  }
}
