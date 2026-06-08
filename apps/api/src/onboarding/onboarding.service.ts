import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ONBOARDING_STEPS = [
  'assistant',
  'knowledge-base',
  'integration',
  'workflow',
] as const;

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return {
      completed: user.onboardingCompleted,
      step: user.onboardingStep,
      totalSteps: ONBOARDING_STEPS.length,
      steps: ONBOARDING_STEPS,
      currentStepKey: ONBOARDING_STEPS[user.onboardingStep] ?? null,
    };
  }

  async advanceStep(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const next = user.onboardingStep + 1;
    const completed = next >= ONBOARDING_STEPS.length;
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        onboardingStep: completed ? user.onboardingStep : next,
        onboardingCompleted: completed,
      },
    });
  }

  async complete(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true, onboardingStep: ONBOARDING_STEPS.length },
    });
  }

  async skip(userId: string) {
    return this.complete(userId);
  }
}
