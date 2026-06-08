import { Controller, Post, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SignupService } from './signup.service';
import { PasswordResetService } from './password-reset.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { Public } from '../common/decorators';import {
  LoginDto,
  Enable2FaDto,
  UpdateThemeDto,
  ChangePasswordDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private signup: SignupService,
    private passwordReset: PasswordResetService,
    private systemSettings: SystemSettingsService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const { user } = await this.signup.register(dto);
    return this.authService.login(
      { email: dto.email, password: dto.password },
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Public()
  @Get('registration-status')
  async registrationStatus() {
    return { enabled: await this.systemSettings.isRegistrationEnabled() };
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordReset.requestReset(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordReset.resetPassword(dto);
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
