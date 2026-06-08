import { Module, Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OnboardingService } from './onboarding.service';

@Controller('v1/onboarding')
@UseGuards(AuthGuard('jwt'))
export class OnboardingController {
  constructor(private onboarding: OnboardingService) {}

  @Get('status')
  status(@Req() req: { user: { id: string } }) {
    return this.onboarding.getStatus(req.user.id);
  }

  @Post('advance')
  advance(@Req() req: { user: { id: string } }) {
    return this.onboarding.advanceStep(req.user.id);
  }

  @Post('complete')
  complete(@Req() req: { user: { id: string } }) {
    return this.onboarding.complete(req.user.id);
  }

  @Post('skip')
  skip(@Req() req: { user: { id: string } }) {
    return this.onboarding.skip(req.user.id);
  }
}

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
